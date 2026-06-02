import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

function sanitizeEnvValue(value) {
  let trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function parseEnvFile(content) {
  const out = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = sanitizeEnvValue(trimmed.slice(eq + 1))
    if (key) out[key] = value
  }
  return out
}

function findMonorepoRoot(startDir) {
  let dir = resolve(startDir)
  while (true) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) return startDir
    dir = parent
  }
}

function applyEnvFile(path, { override = false } = {}) {
  if (!existsSync(path)) return
  const parsed = parseEnvFile(readFileSync(path, 'utf-8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (override || !process.env[key]) {
      process.env[key] = value
    }
  }
}

/** Load env before Next.js config/build — lowest priority first, shell env wins. */
export function loadProjectEnv() {
  const appDir = dirname(fileURLToPath(import.meta.url))
  const root = findMonorepoRoot(appDir)

  // Defaults → repo root .env → apps/web/.env (later files fill gaps only)
  applyEnvFile(resolve(appDir, 'config/public-env.defaults'))
  applyEnvFile(resolve(root, '.env'))
  applyEnvFile(resolve(appDir, '.env'))

  if (process.env.VANTERA_ENV_FILE) {
    applyEnvFile(resolve(process.env.VANTERA_ENV_FILE), { override: true })
  }
}

loadProjectEnv()
