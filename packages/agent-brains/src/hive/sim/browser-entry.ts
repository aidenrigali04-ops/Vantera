/**
 * Browser bundle entry for the Hive viewer: the real engine + simulator, no I/O. Built with
 * `esbuild --bundle --format=iife --global-name=HiveSim` (see sim/README.md).
 */
export { runSim } from "./run";
export { exportRun } from "./export";
export { FAMILIES } from "./world";
export { ARENAS, ARENA_KEYS } from "../arenas";
export { HIVE_DEFAULTS, clampHiveConfig } from "../config";
