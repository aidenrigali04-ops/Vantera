# Campaign pipeline (locked 2026-06-11)

How outreach campaigns are created and how SDR agents act once set up. This wizard is the front door to the entire outreach system — every campaign goes through it.

## Campaign creation wizard

```
Create Campaign → Channels → Targeting config → Copywriting → Run options → [Preview] → Launch
```

### 1. Channels
Choose LinkedIn, Email, or both. Channels map to the locked infra interfaces (`linkedin-infra` via Unipile, `email-infra` via Smartlead).

### 2. Targeting config (Industries + ICPs)
- Input is a **type-ahead bar, not a select dropdown** — users type their own industries/ICPs freely.
- **Max 3 user-entered selections**, multiple allowed up to that cap.
- A **default option** is always offered: the industry/ICP captured during onboarding.
- Once targeting is selected, the **SDR Prospect Agent status indicator flips to Live** — shown as the agent's name (custom name if set, else "SDR Prospect Agent") with a `(Live)` status symbol.

### 3. Copywriting
Two paths, user picks one:
- **Draft their own copy** — inline editor.
- **Copy SDR agent writes it** — the copy is **not displayed**; the wizard moves to the next step immediately when chosen (the agent tailors copy per lead later in the pipeline).

### 4. Campaign run options
This is the information the Prospect Agent uses to run outreach:
- **Run time** — a time picker (e.g. 8:00 AM, with other time options) plus cadence: **every day** or **every week**.
- **Send mode** — three options:
  - **Automatic outreach** — agent sends without human review.
  - **Review before send** — agent drafts queue for user approval before sending.
  - **Manual draft** — user writes/approves everything.
  - The default mode is **auto-selected from the copywriting step**: user-drafted copy → manual draft preselected; agent copy → automatic preselected. User can override.

### 5. Preview (Automatic outreach only)
If **Automatic outreach** was chosen, show a **test display**: a real sample lead plus the copy tailored to that specific lead — so the user sees the face value of exactly what will be sent on their behalf. **Manual and Review modes skip this step.**

### 6. Launch campaign

## Agent behavior contract after launch

1. The **Prospect Agent (Live)** sources prospects matching the campaign's industries/ICPs through the standard quality gate: Explorium discovery → rules gate → AI rank → post-gate enrichment (email verification / phone validation). Only passing leads enter the campaign.
2. The **scheduler** executes sends at the configured run time and cadence through the channel infra interfaces, always within the channel safety limits (LinkedIn ramp/weekly ceiling, email warmup/caps).
3. **Send mode governs human-in-the-loop**: automatic sends directly; review queues per-lead drafts for approval; manual surfaces drafts for the user to finish.
4. Replies flow into the shared reply-classification handler regardless of mode.