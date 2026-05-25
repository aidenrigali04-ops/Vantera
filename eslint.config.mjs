import eslint from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import tseslint from 'typescript-eslint'

/** @type {import("eslint").Linter.Config[]} */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      // Register only rules compatible with ESLint 9 flat config. The full
      // eslint-config-next preset uses legacy APIs (e.g. getAncestors) that
      // crash under ESLint 9 — this fixes missing @next/next/no-img-element.
      '@next/next/no-img-element': 'warn',
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
    ],
  },
)
