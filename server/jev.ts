/**
 * Asks TypeSafe's Jev which agent profile fits a task, and applies the
 * confidence policy to its answer. Self-contained so the tests can run it
 * without the Paseo runtime.
 */

export interface Profile {
  id: string;
  name: string;
  notes?: string;
  provider: string;
  model?: string;
  modeId?: string;
  thinkingOptionId?: string;
  featureValues?: Record<string, unknown>;
}

export interface JevAnswer {
  profile: Profile;
  confidence: number | null;
}

export interface Decision {
  profile: Profile;
  confidence: number | null;
  reason: string;
}

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
const TIMEOUT_MS = 10_000;

/**
 * One choice label per profile. Jev answers with the label, so labels must be
 * unique; a repeated name gets a numeric suffix.
 */
export function choiceLabels(profiles: readonly Profile[]): Map<string, Profile> {
  const labels = new Map<string, Profile>();
  for (const profile of profiles) {
    const base = profile.name.trim() || profile.id;
    let label = base;
    for (let n = 2; labels.has(label); n++) label = `${base} (${n})`;
    labels.set(label, profile);
  }
  return labels;
}

export function requestBody(task: string, labels: Map<string, Profile>): string {
  const criteria = Object.fromEntries(
    [...labels].map(([label, profile]) => [
      label,
      profile.notes?.trim() ? `${label}: ${profile.notes.trim()}` : label,
    ]),
  );
  return JSON.stringify({
    model: JEV_MODEL,
    state: { task },
    questions: {
      profile: {
        type: "choice",
        instructions: "Which agent profile should handle this task?",
        criteria,
      },
    },
  });
}

/** Reads Jev's answer; null when the response is not a usable choice. */
export function readAnswer(responseText: string, labels: Map<string, Profile>): JevAnswer | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return null;
  }
  const answer = (parsed as { answers?: { profile?: Record<string, unknown> } }).answers?.profile;
  const profile = typeof answer?.choice === "string" ? labels.get(answer.choice) : undefined;
  if (!profile) return null;
  return {
    profile,
    confidence: typeof answer?.confidence === "number" ? answer.confidence : null,
  };
}

export async function classify(
  task: string,
  profiles: readonly Profile[],
  apiKey: string,
): Promise<JevAnswer> {
  const labels = choiceLabels(profiles);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  let text: string;
  try {
    response = await fetch(JEV_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: requestBody(task, labels),
      signal: controller.signal,
    });
    text = await response.text();
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Jev did not answer within ${TIMEOUT_MS / 1000}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`Jev responded ${response.status}: ${text.slice(0, 200)}`);
  }
  const answer = readAnswer(text, labels);
  if (!answer) throw new Error("Jev returned no usable profile choice");
  return answer;
}

/**
 * Keeps Jev's pick when it is confident enough. Below `minConfidence` the
 * fallback profile wins, if one is set and still exists; otherwise the pick
 * stands, and the reason says it was unsure.
 */
export function decide(
  answer: JevAnswer,
  profiles: readonly Profile[],
  minConfidence: number,
  fallbackProfileId: string,
): Decision {
  const { profile, confidence } = answer;
  const shown = confidence === null ? "no confidence" : confidence.toFixed(2);
  if (confidence === null || confidence >= minConfidence) {
    return { profile, confidence, reason: `Jev chose ${profile.name} (${shown})` };
  }
  const fallback = profiles.find((candidate) => candidate.id === fallbackProfileId);
  if (fallback) {
    return {
      profile: fallback,
      confidence,
      reason: `Jev was unsure (${profile.name} ${shown}, below ${minConfidence}); used fallback ${fallback.name}`,
    };
  }
  return {
    profile,
    confidence,
    reason: `Jev was unsure (${profile.name} ${shown}, below ${minConfidence}); no fallback set, kept its pick`,
  };
}

/** The agent config a profile describes, in the SDK's `provider/model` form. */
export function agentConfig(profile: Profile) {
  return {
    provider: profile.model ? `${profile.provider}/${profile.model}` : profile.provider,
    modeId: profile.modeId,
    thinkingOptionId: profile.thinkingOptionId,
    featureValues: profile.featureValues,
  };
}
