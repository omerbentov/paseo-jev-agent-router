import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * The router's own settings, in a private file on the daemon machine. The key
 * lives here, not in a Paseo settings document, so it never reaches the app.
 * install.sh writes the same file.
 */
export interface StoredSettings {
  typesafeApiKey: string;
  minConfidence: number;
  fallbackProfileId: string;
}

const DEFAULTS: StoredSettings = { typesafeApiKey: "", minConfidence: 0.5, fallbackProfileId: "" };

export function settingsPath(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "paseo-jev-agent-router", "config.json");
}

export async function readSettings(): Promise<StoredSettings> {
  let raw: string;
  try {
    raw = await readFile(settingsPath(), "utf8");
  } catch {
    return { ...DEFAULTS };
  }
  const parsed = JSON.parse(raw) as Partial<StoredSettings>;
  return {
    typesafeApiKey: typeof parsed.typesafeApiKey === "string" ? parsed.typesafeApiKey : "",
    minConfidence: typeof parsed.minConfidence === "number" ? parsed.minConfidence : DEFAULTS.minConfidence,
    fallbackProfileId: typeof parsed.fallbackProfileId === "string" ? parsed.fallbackProfileId : "",
  };
}

export async function writeSettings(settings: StoredSettings): Promise<void> {
  const path = settingsPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600 });
  // `mode` applies only when the file is created; tighten an existing one too.
  await chmod(path, 0o600);
}

/** TYPESAFE_API_KEY in the daemon's environment wins over the stored key. */
export function resolveKey(settings: StoredSettings): { key: string; source: "env" | "file" | "none" } {
  const fromEnv = process.env.TYPESAFE_API_KEY?.trim();
  if (fromEnv) return { key: fromEnv, source: "env" };
  if (settings.typesafeApiKey) return { key: settings.typesafeApiKey, source: "file" };
  return { key: "", source: "none" };
}
