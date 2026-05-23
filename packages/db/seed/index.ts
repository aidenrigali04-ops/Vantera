import 'dotenv/config'

import { seedTestAccount } from './test-account.js'
import { seedVerticalTemplates } from './vertical-templates.js'

async function main(): Promise<void> {
  console.log('Starting Vantera database seed...')

  await seedTestAccount()
  await seedVerticalTemplates()

  console.log('\nSeed complete.')
  process.exit(0)
}

main().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
