import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import type { getStatus, routeTask, saveSettings } from "../shared/contracts";
import { ROUTE_ROW_KIND, ROUTE_ROW_VERSION } from "../shared/contracts";
import { agentConfig, classify, decide, type Decision, type Profile } from "./jev";
import { readSettings, resolveKey, writeSettings } from "./store";

type PaseoApi = PluginHandlerContext["paseo"];

/**
 * Profiles are read from the daemon on every call, so a profile added, edited
 * or removed in Paseo is routed to on the next task without a reload.
 */
async function loadProfiles(paseo: PaseoApi): Promise<Profile[]> {
  const { config } = await paseo.config.get();
  return (config.agentProfiles ?? []) as Profile[];
}

async function status(paseo: PaseoApi): Promise<RpcOutput<typeof getStatus>> {
  const [settings, profiles] = await Promise.all([readSettings(), loadProfiles(paseo)]);
  return {
    keySource: resolveKey(settings).source,
    minConfidence: settings.minConfidence,
    fallbackProfileId: settings.fallbackProfileId,
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      hasNotes: Boolean(profile.notes?.trim()),
    })),
  };
}

export function handleStatus(_input: RpcInput<typeof getStatus>, { paseo }: PluginHandlerContext) {
  return status(paseo);
}

export async function handleSave(
  input: RpcInput<typeof saveSettings>,
  { paseo }: PluginHandlerContext,
) {
  const current = await readSettings();
  await writeSettings({
    typesafeApiKey: input.typesafeApiKey === undefined ? current.typesafeApiKey : input.typesafeApiKey.trim(),
    minConfidence: input.minConfidence,
    fallbackProfileId: input.fallbackProfileId,
  });
  return status(paseo);
}

export async function handleRoute(
  { workspaceId, task }: RpcInput<typeof routeTask>,
  { paseo }: PluginHandlerContext,
): Promise<RpcOutput<typeof routeTask>> {
  const [settings, profiles] = await Promise.all([readSettings(), loadProfiles(paseo)]);
  if (profiles.length === 0) {
    throw new Error("No agent profiles are configured. Add some under Settings → Agent profiles.");
  }

  let decision: Decision;
  if (profiles.length === 1) {
    // Nothing to choose between; skip the network call.
    decision = { profile: profiles[0], confidence: null, reason: "Only one profile is configured" };
  } else {
    const { key } = resolveKey(settings);
    if (!key) {
      throw new Error("No TypeSafe API key. Add it under Settings → Plugins → Jev agent router.");
    }
    const answer = await classify(task, profiles, key);
    decision = decide(answer, profiles, settings.minConfidence, settings.fallbackProfileId);
  }
  console.log(`[jev-agent-router] ${decision.reason}`);

  const agent = await paseo.workspaces.ref(workspaceId).agents.create({
    config: agentConfig(decision.profile),
    prompt: task,
    labels: { "jev.profile": decision.profile.name },
  });

  const row = {
    profileName: decision.profile.name,
    confidence: decision.confidence,
    reason: decision.reason,
  };
  // The row only explains the choice; the agent already runs without it.
  await agent.timeline
    .append({ type: "plugin", id: "jev-route", kind: ROUTE_ROW_KIND, version: ROUTE_ROW_VERSION, data: row })
    .catch((error: unknown) => console.error(`[jev-agent-router] could not append the route row: ${String(error)}`));

  return { agentId: agent.id, ...row };
}
