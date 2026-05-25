import { config } from 'dotenv'
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'

let loadedFrom: string | null | undefined

function findMonorepoRoot(startDir: string): string | null {
  let dir = resolve(startDir)
  while (true) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return null
    }
    dir = parent
  }
}

/**
 * Load `.env` for CLI tools (Larry, scripts) when not already injected by
 * dotenv-cli / Vercel / Trigger.dev. Safe to call multiple times.
 */
export function loadProjectEnv(): { loadedFrom: string | null; alreadyPresent: boolean } {
  if (loadedFrom !== undefined) {
    return { loadedFrom, alreadyPresent: loadedFrom === null }
  }

  const root = findMonorepoRoot(process.cwd())
  const candidates = [
    process.env.VANTERA_ENV_FILE,
    root ? resolve(root, '.env') : null,
    root ? resolve(root, 'apps/web/.env') : null,
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'apps/web/.env'),
  ].filter((path): path is string => Boolean(path))

  const seen = new Set<string>()
  for (const envPath of candidates) {
    if (seen.has(envPath) || !existsSync(envPath)) continue
    seen.add(envPath)

    // Do not override vars already set by the shell / Vercel / Trigger.dev
    config({ path: envPath, override: false, quiet: true })
    loadedFrom = envPath
    return { loadedFrom: envPath, alreadyPresent: false }
  }

  loadedFrom = null
  return { loadedFrom: null, alreadyPresent: true }
}

export function getLoadedEnvPath(): string | null {
  if (loadedFrom === undefined) {
    loadProjectEnv()
  }
  return loadedFrom ?? null
}
