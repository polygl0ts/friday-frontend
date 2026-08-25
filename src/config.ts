/**
 * Configuration supplied by the web server at runtime.
 *
 * Keeping these as exported `let` bindings is intentional: ES module imports
 * are live, so the API clients see the values as soon as startup finishes
 * loading config.json, even though those clients are imported before `main`
 * starts its bootstrap function.
 */
export interface RuntimeConfig {
  rctfOrigin: string;
  extrasOrigin: string;
}

interface ConfigFile {
  rctfOrigin?: unknown;
  extrasOrigin?: unknown;
  rctf_origin?: unknown;
  extras_origin?: unknown;
  VITE_RCTF_ORIGIN?: unknown;
  VITE_EXTRAS_ORIGIN?: unknown;
}

// The environment fallback is for Vite's test/dev module imports only.
const env = import.meta.env as Record<string, unknown>;

export let rctfOrigin = typeof env.VITE_RCTF_ORIGIN === "string" ? env.VITE_RCTF_ORIGIN : "";
export let extrasOrigin =
  typeof env.VITE_EXTRAS_ORIGIN === "string" ? env.VITE_EXTRAS_ORIGIN : "";

let loaded = false;

function readOrigin(
  config: ConfigFile,
  camelKey: keyof ConfigFile,
  snakeKey: keyof ConfigFile,
  envKey: keyof ConfigFile,
): string | undefined {
  for (const key of [camelKey, snakeKey, envKey]) {
    const value = config[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function normalizeConfig(value: unknown): RuntimeConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("config.json must contain a JSON object");
  }

  const config = value as ConfigFile;
  const nextRctfOrigin = readOrigin(config, "rctfOrigin", "rctf_origin", "VITE_RCTF_ORIGIN");
  const nextExtrasOrigin = readOrigin(config, "extrasOrigin", "extras_origin", "VITE_EXTRAS_ORIGIN");

  if (nextRctfOrigin === undefined || nextExtrasOrigin === undefined) {
    throw new Error("config.json must define rctfOrigin and extrasOrigin");
  }

  return { rctfOrigin: nextRctfOrigin, extrasOrigin: nextExtrasOrigin };
}

export function setRuntimeConfig(config: RuntimeConfig): void {
  rctfOrigin = config.rctfOrigin;
  extrasOrigin = config.extrasOrigin;
  loaded = true;
}

export function getRuntimeConfig(): RuntimeConfig {
  return { rctfOrigin, extrasOrigin };
}

/** Load and validate the server-provided configuration before rendering. */
export async function loadRuntimeConfig(url = "./config.json"): Promise<RuntimeConfig> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load ${url} (${response.status} ${response.statusText})`);
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(`${url} did not contain valid JSON`);
  }

  const config = normalizeConfig(value);
  setRuntimeConfig(config);
  return config;
}

export function isRuntimeConfigLoaded(): boolean {
  return loaded;
}
