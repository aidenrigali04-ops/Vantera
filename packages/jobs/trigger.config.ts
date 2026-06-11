import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Trigger.dev cloud project "Vantera" — the ref is not a secret
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_jzndkpjvnrfgzgafavma",
  runtime: "node",
  dirs: ["./src/trigger"],
  // ceiling per run, in seconds; SDR pipeline tasks override as needed (rule 02: long AI calls)
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
