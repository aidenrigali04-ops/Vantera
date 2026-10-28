---
title: Your Prospect Agent
surface: agents
routes: /playbook, /playbook/new/scout, /playbook/scout, /playbook/scout/targeting
---

# Your Prospect Agent

The Prospect Agent is your prospecting teammate. Once deployed, it hunts for people matching your ideal customer profile on a schedule, scores every one of them, and keeps only the high-quality prospects.

## Setting it up

1. **Name your agent** — anything you like; the name shows on its card and status.
2. **ICPs** — type up to 3 ideal customer profiles. Your onboarding ICP is offered as a ready-made chip, and you can add your own (e.g. "Heads of RevOps at Series A SaaS").
3. **Schedule** — pick a run time and whether it runs every day or every week. Times use your timezone.
4. **Deploy** — your agent goes Live. Its first run starts within about 15 minutes; after that it follows your schedule.

## What happens on each run

- It searches for new prospects matching each ICP.
- Every prospect passes a strict quality check first — industry, company size, role, and location fit.
- Survivors are enriched with verified contact details and buying signals (hiring, funding, technology changes).
- Each prospect gets a score from 0–100 with a plain-English rationale, plus tailored insights: pain points, triggers, and the moment your offer clicks for them.
- Only prospects scoring 70+ move on to outreach.
- People whose headline says they're job hunting ("Open to Work", "seeking new opportunities") are skipped — someone looking for a job isn't a buyer.
- If scoring is briefly unavailable, unscored prospects are kept and scored on a later run instead of being thrown away.

If you've added your website URL in settings, the agent reads your homepage so its scoring understands exactly what you sell.

## Targeting rules

Open **Playbook → Targeting** to tell your agents who to look for, who to skip, and who to favor. At the top is your buyer profile as editable chips: **Job titles**, **Industries**, **Company size**, **Locations**, and **Signals**. Below it are the skip rules and your own guidance:

- **Always skip** agencies and consultants, or freelancers and self-employed people.
- **Competitors**, **existing customers**, and **other companies** to skip — one per line (a website like acme.com works too).
- **Keywords to skip**, matched in job titles, company names, and industries.
- **Who to prioritize or avoid**, in your own words — your agent weighs it when scoring, the same way it weighs your ICP.

Saving updates both the buyer profile your agents score against and the skip rules, so there is one place for both. Skips are checked before anything is spent on a prospect, and they apply to everyone your agents find — from search and from LinkedIn intent alike. Prospects you add yourself are never skipped. Your guidance never lowers the 70+ quality bar.

## It learns from your results

Your agent gets sharper the more you use it:

- **Your review decisions teach the scoring.** When you reject a draft as **Wrong person**, similar people score lower on future runs. Prospects who reply with interest teach it the opposite.
- **Your replies decide who goes first.** You can only send a limited number of new invitations each day, so the agent fills those slots with the qualified prospects most like the people who actually replied — by buying signal, role, industry, company size, and even score range. It only counts invitations old enough to have had a fair chance at a reply, and it needs real evidence before it changes anything; a brand-new account simply goes highest score first.
- **It spots lookalikes.** Once a few prospects have replied with interest, booked, closed, or been marked a good fit, your agent compares every new prospect's profile to theirs. If people who look like your winners really do reply more, those prospects move up — and you'll see "Looks like your best replies" as a reason. It only ever compares against your own results.
- The 70+ quality bar never moves — learning decides *who goes first*, not who qualifies.

## Seeing what your agent actually did

Every scheduled run leaves a record. The agent's card shows what the **last run** did ("25 sourced → 20 passed gate → 5 qualified"), and the agent's page keeps the **recent runs** list — so a quiet week is never a mystery. If a live agent hits something that needs you — a search that came back empty, an ICP it couldn't turn into a search, scoring that failed before anyone was qualified, a LinkedIn connection that's dropped — its status turns amber (**Needs attention**) with the reason and the fix, instead of showing a green "Live" that hides the problem.

The card also carries a small funnel for this agent alone: **Found → Contacted → Replied**, counting only the prospects it found, with each step as a share of the one before. Before it has found anyone, the funnel reads "No prospects found yet". The numbers are the same ones the Prospect agent row shows on Results, so the two always agree.

The agent's page ends with an **Activity** list: what has happened in your workspace, newest first. It shows setup moments ("Site read", "Prospect agent live") alongside each recorded run of your Prospect and Intent agents, so you can see what was done and when.

**Run now** starts a run immediately instead of waiting for the next scheduled one — handy right after you change your targeting, so you can verify the change worked. It's the exact same run the schedule fires.

## Pausing and resuming

Use **Pause** on the agent card to stop runs at any time; **Resume** picks the schedule back up. Pausing never deletes anything.
