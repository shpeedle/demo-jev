import { TypeSafeClient } from "@typesafe-ai/sdk";

/** One client for every sample. Reads TYPESAFE_API_KEY and calls `jev-latest` by default. */
export function makeClient(): TypeSafeClient {
  try {
    process.loadEnvFile(); // .env in the working directory; real env vars take precedence
  } catch {
    // no .env file; fall back to the environment
  }
  if (!process.env.TYPESAFE_API_KEY) {
    console.error("Set TYPESAFE_API_KEY in .env (get one at https://console.typesafe.ai/keys).");
    process.exit(1);
  }
  return new TypeSafeClient();
}

/** A 0..1 value as a fixed-width bar, e.g. `████░░░░░░ 0.42`. */
export function bar(p: number, width = 20): string {
  const filled = Math.round(Math.max(0, Math.min(1, p)) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)} ${p.toFixed(2)}`;
}

/** Print every option of a probability map, highest first. */
export function printDistribution(probabilities: Readonly<Record<string, number>>, indent = "    "): void {
  const rows = Object.entries(probabilities).sort(([, a], [, b]) => b - a);
  const pad = Math.max(...rows.map(([k]) => k.length));
  for (const [label, p] of rows) console.log(`${indent}${label.padEnd(pad)}  ${bar(p)}`);
}

export function heading(text: string): void {
  console.log(`\n\x1b[1m${text}\x1b[0m`);
}

export function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}
