import { seedVerticalTemplates } from './vertical-templates.js'

// .env is loaded by the `dotenv -e .env -- tsx ...` wrapper in `pnpm db:seed`.
// We deliberately don't `import 'dotenv/config'` because the `dotenv` package
// isn't a dependency — only `dotenv-cli` is.

async function main(): Promise<void> {
  console.log('Starting Vantera database seed...')

  await seedVerticalTemplates()

  console.log('\nSeed complete.')
  process.exit(0)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
