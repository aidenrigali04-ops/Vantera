/**
 * Simulates Outreach Agent wizard validation from start to finish.
 * Run: pnpm --filter web exec tsx scripts/simulate-outreach-agent-flow.ts
 */
import assert from 'node:assert/strict'
import {
  normalizeLinkedCampaignIds,
  validateLaunchOutreachAgentInput,
  validateUpdateOutreachAgentInput,
} from '../lib/outreach-agent/validate'

const SAMPLE_CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111'
const SAMPLE_CAMPAIGN_ID_2 = '22222222-2222-4222-8222-222222222222'

function step(label: string) {
  console.log(`✓ ${label}`)
}

console.log('Simulating Outreach Agent setup flow…\n')

// Step 1 — identity
const emptyName = validateLaunchOutreachAgentInput({
  agentName: '   ',
  linkedCampaignIds: [SAMPLE_CAMPAIGN_ID],
})
assert.equal(emptyName, 'Agent name is required')
step('Step 1 blocks empty agent name')

// Step 2 — campaign linking
const noCampaigns = validateLaunchOutreachAgentInput({
  agentName: 'Outreach Agent',
  linkedCampaignIds: [],
})
assert.equal(noCampaigns, 'Link at least one campaign to activate Outreach Agent')
step('Step 2 blocks launch with zero linked campaigns')

const invalidId = normalizeLinkedCampaignIds(['not-a-uuid', SAMPLE_CAMPAIGN_ID])
assert.deepEqual(invalidId, [SAMPLE_CAMPAIGN_ID])
step('Step 2 normalizes invalid campaign IDs')

// Step 3 — review payload
const reviewPayload = {
  agentName: '  Pipeline Outreach  ',
  linkedCampaignIds: [SAMPLE_CAMPAIGN_ID, SAMPLE_CAMPAIGN_ID_2, SAMPLE_CAMPAIGN_ID],
}
const reviewError = validateLaunchOutreachAgentInput(reviewPayload)
assert.equal(reviewError, null)
step('Step 3 review payload passes validation')

// Step 4 — launch
const launchError = validateLaunchOutreachAgentInput({
  agentName: reviewPayload.agentName.trim(),
  linkedCampaignIds: normalizeLinkedCampaignIds(reviewPayload.linkedCampaignIds),
})
assert.equal(launchError, null)
assert.equal(normalizeLinkedCampaignIds(reviewPayload.linkedCampaignIds).length, 2)
step('Step 4 launch payload is production-ready')

// Post-setup — manage links from command center
const unlinkAll = validateUpdateOutreachAgentInput({ linkedCampaignIds: [] })
assert.equal(unlinkAll, 'Keep at least one linked campaign')
step('Command center blocks removing every linked campaign')

const updateLinks = validateUpdateOutreachAgentInput({
  agentName: 'Renamed Agent',
  linkedCampaignIds: [SAMPLE_CAMPAIGN_ID_2],
})
assert.equal(updateLinks, null)
step('Command center link update passes validation')

console.log('\nAll outreach agent flow checks passed.')
