import { seedVerticalTemplates } from '../seed/vertical-templates.js'

seedVerticalTemplates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
