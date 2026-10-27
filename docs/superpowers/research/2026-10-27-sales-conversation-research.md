# What top salespeople actually do in text-based prospecting conversations — research brief for an AI SDR policy

Scope: B2B LinkedIn outreach run by an AI agent that converses until a meeting is booked. Evidence is weighted toward large-sample message analyses (Gong, Lavender, LinkedIn, Waalaxy, Belkins, Expandi), peer-reviewed communication research, and named practitioners with published material. Nearly all outreach datasets are vendor-published; treat magnitudes as directional, directions as reliable where several independent datasets agree. Most message-mechanics data is email; LinkedIn-specific numbers are flagged.

---

## 1. Methodologies, differentiated

**SPIN (Rackham, 1988)** — Situation → Problem → Implication → Need-payoff questions. Built on observation of ~35,000 sales calls, which makes it the only classic method with a real empirical base ([salesgrowth.com](https://salesgrowth.com/gap-selling-vs-spin-selling/)). Fits: discovery once the prospect is already talking; mid-level operators who will answer questions. Backfires: in a cold first message or with executives — Gong's executive data says explicitly not to put discovery questions in cold email, because execs decide whether to open in <3 s and read for ≤9 s ([Gong](https://www.gong.io/blog/do-execs-really-reply-to-cold-email-here-s-what-the-data-says)). Signature moves: Implication ("what happens downstream when X slips?"), Need-payoff ("if that went away, what would it free up?").

**Challenger (CEB/Dixon & Adamson, 2011)** — Teach (a commercial insight that reframes the problem) → Tailor (to the stakeholder) → Take Control (of the process). Origin is a correlational profile study of ~6,000 reps; it identifies which rep profile wins complex deals, not a tested script ([salesgrowth.com](https://salesgrowth.com/gap-selling-vs-challenger-sale/)). Fits: senior buyers who already have a vendor and are skeptical of "help" — a reframe is the only thing that earns a reply from a satisfied status-quo buyer. Backfires: with junior buyers (reads as condescending), or when the "insight" is generic — Gong's 85M-email report found buzzword/number subject lines and ROI language reduce replies ([30MPC/Gong report](https://tactics.30mpc.com/hubfs/The%20Ultimate%20Cold%20Email%20Data%20Report-1.pdf)). Signature pattern: "Most [role]s assume X; the ones hitting [goal] are doing Y instead."

**Sandler** — Pain funnel ("Tell me more about that" → "Can you be more specific?" → "How long has it been an issue?" → "What have you tried?" → "What has it cost you?" → "How do you feel about that?") plus up-front contracts and "negative reverse" (giving the prospect permission to say no) ([a79.ai Sandler guide](https://www.a79.ai/resources/sandler-selling-system)). Fits: the conversation phase after a reply; skeptical/direct prospects respond to permission to disengage. Backfires: the full funnel is an interrogation if run in sequence over chat; and "how do you feel about that?" reads as manipulative in text. Signature moves: up-front contract ("If it's not a fit, say so and I'll leave you alone"), pain-funnel steps 1–2 and 5 only.

**Gap Selling (Keenan)** — current state → future state → quantify the gap; three pain layers: problem, impact, root cause, with impact driving the decision ([salesgrowth.com](https://salesgrowth.com/gap-selling-vs-sandler-methodology/)). Fits: a prospect who has acknowledged a problem and will give a number. Backfires: asking for numbers before trust. Signature: "What's that costing you per month, roughly?" — only after a stated problem.

**MEDDIC** — Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion ([salesgrowth.com](https://salesgrowth.com/meddic)). A qualification checklist, not a conversation method. Fits: internal gating of which conversations to push toward a meeting. Backfires: asked out loud ("who's the decision maker?") in text — it is the clearest "I am a script" tell. Use it as the agent's hidden state, never as questions.

**Consultative** — the umbrella; its one durable move is the diagnostic question that is useful even if they never buy (Gong's rule: "Is this insight useful even if they don't buy from you? If no, you're pitching" — [Gong templates](https://www.gong.io/files/gong-template-cold-email-templates.pdf)).

**Permission-based / "demand gen" prospecting (2019–2026 practitioners)**

- **Josh Braun — "Poke the Bear."** A *neutral* question that surfaces a risk in the current approach, never leading. Construction rule: "What do you know that your prospect might not know that can hurt them?" Examples: "If you run MVRs quarterly, how do you know violations aren't occurring between pulls?", "How do you know you're not being overcharged for shipping?" ([joshbraun.com](https://joshbraun.com/how-to-poke-the-bear/)). Leading questions ("Having a solid plan is important, don't you think?") put prospects on the defensive ([joshbraun.com](https://joshbraun.com/ditch-the-pitch-poke-the-bear/)). His cold-call sequence is: permission → context → qualifying question → label → the poke → tease what's possible ([joshbraun.com](https://joshbraun.com/poke-the-bear-cold-call-script/)). Core stance: detach from the outcome; "letting go of expectations lowers prospects' resistance because they stop feeling pushed" ([joshbraun.com](https://joshbraun.com/lowering-resistance-during-a-cold-call/)). Fits: skeptical, senior, "we're fine" prospects. Backfires: when the poke is really a pitch in a question costume.
- **Jason Bay — REPLY method (Outbound Squad).** Results, Empathy, Personalization, Laser-focus, You: write from "why prospects buy" — their job, recurring challenges, what they need to see to *want* to respond ([Future-Proof Selling](https://futureproofselling.libsyn.com/website/getting-responses-to-emails-and-calls-with-prospecting-expert-jason-bay)). Bay authored Gong's 2025 28M-email analysis: pitching cuts reply rates up to 57%; top reps write in the buyer's language, ≤100 words, 3–4 sentences, and avoid "AI", "platform", "all-in-one" ([Gong](https://www.gong.io/blog/does-cold-email-even-work-any-more-heres-what-the-data-says)).
- **Sam McKenna — "Show Me You Know Me."** Six components: subject line, opening line, connecting the dots, challenge + value prop ("So-What formula": lead with the buyer's specific pain), pre-empt the forthcoming objection, close ([samsalesconsulting.com](https://www.samsalesconsulting.com/showmeyouknowme/)). The research must be *about them* and visibly non-templatable. Her go-to opener "we have yet to be properly introduced" and SMYKM subject lines are documented at [Outreach Almanac](https://outreachalmanac.com/guides/show-me-you-know-me-cold-email/). Self-reported results after training: open 27→43%, reply 3.8→6.2%, meetings 13→21% (unaudited).
- **Becc Holland (Flip the Script)** — "personalization at scale": personalize on the persona/role and the *reason you're reaching out*, not on fun facts; tailored messaging that stays consistent across hundreds of sends ([G2 webinar](https://gtmnow.com/?p=80205), [JBarrows podcast](https://blog.jbarrows.com/blog/becc-holland-on-personalization-at-scale/)). Primary sources are thin; the position is consistent with Gong's ranking of personalization types (business problems > personal facts).
- **Will Allred / Lavender** — data-first email coaching: under 75 words (25–50 ideal), 3rd–5th-grade reading level (+67% replies), mobile-first formatting (+83%), easy-to-answer questions, no open-ended ones ([Lavender](https://lavender.ai/blog/cold-email-101)).
- **30 Minutes to President's Club (Farrokh/Cegelski)** — "Mr. Miyagi" objection handling: agree → disarm → redirect ("sell the test drive"), with objection classes Dismissive / Situational / Existing-solution ([30MPC](https://www.30mpc.com/blog/18-cold-call-objections-and-how-to-handle-them)).

The practical synthesis: classic methods describe **what to learn** (pain, impact, decision path); the 2019+ practitioners describe **how to earn each turn** (permission, neutrality, specificity, brevity). An AI policy should run MEDDIC/Gap as hidden state and Braun/Bay/McKenna/Lavender as the surface behavior. Note the adoption data: 89% of teams have a defined method, only 36% see reps follow it ([supered.io](https://www.supered.io/blog/sales-methodologies/)) — consistency, not method choice, is the lever an agent can actually pull.

---

## 2. Evidence on message mechanics

**Length.**
- Email (Gong, 28M+ emails, 2025): replies highest at ≤100 words and especially 3–4 sentences; execs: 50–100 words; subject lines 1–4 words, lowercase, no numbers/buzzwords (−17.9% opens) ([Gong](https://www.gong.io/blog/does-cold-email-even-work-any-more-heres-what-the-data-says), [Gong exec study](https://www.gong.io/blog/do-execs-really-reply-to-cold-email-here-s-what-the-data-says)).
- Lavender: <75 words, recommend 25–50; readers scan ~11 s; first open is 8x more likely on a phone ([Lavender](https://lavender.ai/blog/cold-email-101)).
- LinkedIn InMail (LinkedIn, tens of millions of recruiter InMails, May 2021–Apr 2022): <400 characters +22% vs average; ≤800 +5%; 800–1,200 −6%; >1,200 −11%; only 10% of InMails are under 400 chars ([LinkedIn](https://www.linkedin.com/business/talent/blog/talent-strategy/these-inmails-get-best-response-rates)).
- LinkedIn messages (Waalaxy, 64M+ messages, 2025): 1–300 chars 17.5% reply / 4.2% "interested"; 301–500 13.4% / 3.7%; 501–1,000 11.2% / 2.7%; 1,001+ 10.1% / 2.2% — short messages roughly double long ones on both metrics ([Waalaxy 2025 e-book](https://images.g2crowd.com/uploads/attachment/file/1526002/_-E-book-Waalaxy-2025-_US_---Stat-prospection-Lkdn.pdf)).

**Connection notes.** Acceptance is essentially unaffected or slightly hurt by a note; replies after acceptance go up. Belkins (112k sequences, 2025): note lowers acceptance 27.56→25.31% but raises post-accept reply 5.28→8.18% (+55%) ([Belkins](https://belkins.io/blog/sales-follow-up-statistics)); Belkins 20M via Expandi: 26.42% vs 26.37% acceptance, replies 9.36% vs 5.44% ([Expandi](https://expandi.io/blog/linkedin-connection-message-templates/)); Waalaxy: no-note 34.3% vs note 32.3% acceptance ([Waalaxy](https://images.g2crowd.com/uploads/attachment/file/1526002/_-E-book-Waalaxy-2025-_US_---Stat-prospection-Lkdn.pdf)); LaGrowthMachine (~9k): 31% none / 29% sales note / 32% vague note ([LGM](https://lagrowthmachine.com/should-i-add-a-note-to-my-linkedin-connection-request/)). Implication: a *bad* note costs acceptance; a *good* note buys replies. Policy: note only when it can be specific; otherwise blank invite + strong first message.

**Pitch-first vs question-first.** Pitching cuts email reply rates up to 57% (Gong). Waalaxy: a hard CTA in the first LinkedIn message lowers replies (19.0% without vs 12.3% with; "interested" 9.5% vs 6.0%); phone CTA 15.5% vs 14.5%; their recommendation is "no hard CTAs in the first message... save phone or meeting until your second message". Gong's 304k-email CTA study: at the cold stage an *interest* CTA ("open to learning more?") is ~2x a *specific* time ask; the specific ask's meeting rate rises from 15% cold to 37% once a deal is in progress, while the interest CTA falls to 25% — so switch CTA type as the conversation warms ([Gong CTA study](https://www.gong.io/blog/this-surprising-cold-email-cta-will-help-you-book-a-lot-more-meetings)). Gong 85M: the best cold CTAs "make an offer instead of asking for a meeting" (audit, data, trial — something they get even if they don't buy).

**One question per message.** Lavender data (secondary report): >1 question harms reply probability; Lavender's own guidance is easy-to-answer questions, not open-ended ones ([gaidme summary](https://gaidme.com/blog/cold-email-replies-lavender-data-analysis), [Lavender](https://lavender.ai/blog/cold-email-101)). Gong templates: "limit open-ended questions; shift the ask from a phone conversation to a simple email reply" ([Gong templates](https://www.gong.io/files/gong-template-cold-email-templates.pdf)).

**"I noticed" / flattery.** No large-sample study isolates "I noticed". What exists: Gong's opener test found a brief *nicety* is the only opener that helps replies and meetings; every other opener did worse than no opener ([Gong templates](https://www.gong.io/files/gong-template-cold-email-templates.pdf)). In follow-ups, "Hope all is well" raised meetings +24% *when made specific* ([Gong follow-up study](https://www.gong.io/blog/7-tips-for-writing-the-perfect-follow-up-sales-email-according-to-science)). Gong 85M ranks personalization types: business problems/priorities beat personal facts; "executives don't care if you reference their alma mater." Pronouns (Waalaxy, LinkedIn): "I" 1–2 times is best (16.3% reply), 6–10 times drops "interested" to 3.45%; "we" 0 times best (16.3%), 3–5 times 12.6%, more 9.5%. Gong 85M: top reps use more "you/your" language.

**Reply latency.** The speed-to-lead literature (InsideSales/Oldroyd: 21x qualification odds at 5 min vs 30 min; HBR 1.25M leads: 7x within an hour) is about *inbound* leads and is secondary-sourced ([electronics-cooling summary](https://www.electronics-cooling.com/2011/06/increase-your-sales-effectiveness-by-21x-in-25-minutes/), [Chatfuel summary](https://academy.chatfuel.com/speed-to-lead)); directionally, reply fast to a reply. Against instant replies: a controlled experiment found a chatbot with dynamic, length-scaled delays was rated more human and produced higher satisfaction than near-instant replies ([Gnewuch et al., ECIS 2018](https://aisel.aisnet.org/ecis2018_rp/113/)); a 2026 NYU study found short pauses signal deliberation ([NYU](https://engineering.nyu.edu/news/why-faster-ai-isnt-always-better)). LinkedIn: 65% of InMail responses arrive within 24 h, 90% within a week — so a human-plausible window is minutes to hours, not seconds.

**Follow-up cadence and diminishing returns.**
- Email: Belkins 2023 — first follow-up +49% replies, second +9%, third −20% ([Belkins](https://belkins.io/blog/sales-follow-up-statistics)); Gong 85M — ~6 emails over 14–28 days, after which replies fall below 0.5%; Gong 304k — reply rate per follow-up declines from 31% at touch 2 to 14% by touch 8; Belkins 2025 — step 3 alone produced 35.6% of email-sourced meetings.
- LinkedIn: Waalaxy — 2-touchpoint campaigns have the highest reply rate, beyond 2 it declines; Expandi (70k+ campaigns) — the first follow-up adds nothing on its own, the second lifts replies ~4% ([Expandi](https://expandi.io/blog/linkedin-follow-up-message/)). Waalaxy's recommended sequence: note-free invite → 3 messages (first outreach, follow-up, breakup); voice note in the follow-up (16.2%/6.8% vs 15.8%/4.4% interested); Tue–Thu.
- Content of follow-ups is where **reply rate and meeting rate diverge**: Gong 304k found "Thoughts?" raises replies but cuts meetings −20%; "never heard back" −14%; "following up" −5%; a generic "bubble-up" referencing the prior email makes a meeting 15x less likely; mentioning "just called" does nothing. Gong 85M, measuring replies only, found 1-sentence bumps and breakup language nearly double replies. Both are true: bumps harvest replies (many negative); value-adding follow-ups harvest meetings.

**What raises positive-reply rate rather than reply rate.** The Waalaxy "interested reply" column and Gong's meetings-booked column move with: brevity, prospect-focused pronouns, no hard CTA in touch 1, specificity about business problems, and offers. Reply rate alone is gamed by guilt phrasing and breakups. Waalaxy's top-10% campaigns average 47.4% replies vs 16.2% overall; Gong's top 10% of reps book 8.1x the meetings of average and get 4.2x the replies — the meetings gap is twice the replies gap, i.e., top performers' replies are *better*, not just more numerous.

---

## 3. Conversation flow: first reply → booked meeting

Synthesized stages, with the practitioner moves that earn each one:

1. **Open with a reason, not a pitch** (touch 1). Gong top-rep structure: strong reason → problem stated succinctly → social proof → clear ask; Braun: permission + neutral poke; McKenna: proof you did research about *them*. CTA = interest or offer, never a calendar.
2. **Earn the right to ask.** Before any diagnostic question, give something: an observation, a peer pattern, a number. Gong's test: "Is this useful even if they don't buy?" Caveat assumptions ("as an outsider looking in, it seems like…") — "nothing gets your email deleted faster than a wrong assumption" ([Gong templates](https://www.gong.io/files/gong-template-cold-email-templates.pdf)).
3. **Surface pain without interrogating.** One question per message; alternate question → observation → question. Prefer Braun's "how do you know…?" pokes and Sandler's "tell me more" over SPIN implication chains. Gong call data (519k calls) peaks at 11–14 questions *spread across* a conversation, not front-loaded ([Gong](https://www.gong.io/resources/labs/nailing-your-sales-discovery-calls/)); in chat, budget 3–5 questions across the whole thread.
4. **Label and confirm.** Reflect what they said in their words ("sounds like the issue is less X than Y?") — this is Braun's "label" step and Voss's labeling; evidence in §4.
5. **Quantify lightly** (Gap) only after a stated problem: "roughly how often / how much?"
6. **Convert the CTA type.** Once interest is explicit, switch from interest CTA to a specific-time ask — Gong's data shows the specific ask's booking rate more than doubles (15%→37%) once there's engagement.
7. **Up-front contract on the meeting.** Sandler: say what the meeting is, how long, and that "no" is fine.

Go-to responses (practitioner-sourced):

- **"Not interested."** Agree and ask one disarming question: "Totally fair — is that because you've already solved [problem], or because it's not on the radar right now?" ([30MPC via Smartlead](https://www.smartlead.ai/blog/cold-call-objection-handling)); 30MPC's "ledge": pre-set line to buy a beat, then a curiosity question ([Buteau notes](https://www.antoinebuteau.com/lessons-armand-farrokh-and-nick-cegelski/)). Braun: do not "overcome" — poke the bear once, then leave the door open. Never argue.
- **"Send me some info."** Treat as a polite exit, not a request ([skipcall](https://skipcall.io/en/blog/cold-call-objections.md)). Agree, then narrow: "Happy to. So I don't send a generic deck — is it [problem A] or [problem B] that's closer to what you're dealing with?" If they answer, you have discovery; if not, send one specific asset and stop.
- **"What is this?"** Answer in one plain sentence, no jargon, then one neutral question. Gong exec data: no "platform/AI/all-in-one" language.
- **"We already have a vendor."** 30MPC "existing-solution" class: agree ("most of the people I talk to do"), then a poke that only a current user could answer: "How do you know [gap the vendor typically has] isn't happening between [their cadence]?" — Braun's SambaSafety example. Challenger reframe is the only move that works here.
- **Rudeness.** Braun's detachment: no defense, one line that lowers resistance ("Fair — I'll get out of your hair. If [problem] ever comes up, I'm around."). Write to suppression on any explicit opt-out (compliance, and Firmable: 75% have blocked/muted repeated outreach).
- **Silence after a question.** Do not "bump" ("Thoughts?", "following up", "bubbling this up" — all reduce meetings, Gong). Add a new, specific piece of value (peer pattern, data point, relevant resource), re-ask a *different*, easier question, then a single breakup message that leaves the door open (Gong day-21 template; Waalaxy breakup step).

---

## 4. Reading the person

**Seniority.** C-level reply 30.2% less than non-execs; they decide in <3 s and read ≤9 s; lead with *their* strategic objective ("Saw this… [initiative]"), no discovery questions, 50–100 words, offer a benchmark/insight rather than a meeting ([Gong exec study](https://www.gong.io/blog/do-execs-really-reply-to-cold-email-here-s-what-the-data-says)). Managers/operators tolerate one diagnostic question and respond to concrete workflow pain.

**Mirroring and labeling.**
- *Linguistic mimicry in text negotiation* (Swaab, Maddux & Sinaceur, JESP 2011, two chat-based studies): mimicking the counterpart's words/acronyms/emoticons in the **first 10 minutes** improved the mimicker's outcome, mediated by trust; mimicking **late** reversed the benefit; mimicking positive-emotion language works, neutral/negative does not; no participant detected it ([INSEAD summary](https://knowledge.insead.edu/leadership-organisations/mimicry-latest-negotiating-strategy), [paper](https://faculty.essec.edu/research/early-words-that-work-when-and-how-virtual-linguistic-mimicry-facilitates-negotiation-outcomes)).
- *Language Style Matching* (Pennebaker/Ireland): function-word matching tracks engagement; in Ireland & Henderson's 64-dyad IM negotiations, higher LSM increased engagement but could also predict impasse when both sides were dug in ([Discover](https://discovermagazine.com/mind/choose-your-words-wisely-to-win-a-negotiation)); hostage negotiations with higher LSM were more successful (Taylor & Thomas 2008); the broader literature is "largely positive but mixed" ([Romero et al. 2015](https://www.kellogg.northwestern.edu/faculty/uzzi/htm/papers/Pers%20Soc%20Psychol%20Bull-2015-Romero-0146167215591168.pdf)). Policy: match register, sentence length, formality and emoji use early; do not match hostility.
- *Affect labeling* (Lieberman et al., Psychological Science 2007): putting a feeling into words dampens amygdala response — the neural basis for Voss's "It sounds like…" labels ([paper](https://sites.lifesci.ucla.edu/psych-sanlab/wp-content/uploads/sites/31/2016/03/Lieberman_2007_PsychScience.pdf)). No controlled trials of Voss's tactics exist; the practitioner evidence is anecdotal. Use labels sparingly and tentatively ("seems like…", never "I understand you feel…").

**Personality from text.** LinkedIn profile text carries Big-Five signal: a 2024 UCF dissertation (960 employees) predicted all five traits from profile text with open-vocabulary NLP ([UCF](https://stars.library.ucf.edu/etd2023/424)); Tilburg raters using profiles were only ~1.5x better than chance at ranking extraversion ([Tilburg](https://research.tilburguniversity.edu/en/publications/personality-perception-based-on-linkedin-profiles/)). Crystal's "80% accurate" DISC claim is vendor-reported ([Crystal docs](https://docs.crystalknows.com/how-accurate-is-crystal)). No meta-analysis links DISC-based adaptation to sales outcomes; the best peer-reviewed evidence (Homburg et al. 2024, JPSSM, 430 reps) finds personality knowledge only helps via *adaptive selling skill* — i.e., adapting behaviour turn-by-turn matters, labelling the type does not ([Mannheim](https://www.sowi.uni-mannheim.de/en/news/new-publication-in-the-journal-of-personal-selling-sales-management)). Practical adaptation axes with observable text cues: **directness** (short, imperative replies → answer in ≤2 lines, no warm-up), **formality** (punctuation, salutations → mirror), **warmth** (emoji, first names, exclamation → allow one), **skepticism** ("why are you messaging me", "what is this" → drop all claims, one plain sentence + a neutral question, offer the exit).

---

## 5. What reads as AI, "slop", or manipulation in 2025–2026

Buyer-side data:
- Firmable Cold Outreach Pulse (1,009 professionals, Aug 2025): 82% delete or skim-and-delete on sight (52% delete unread); 63% call a *mass-sent appearance* a dealbreaker vs 37% for a generic greeting; 61% distrust incoming AI outreach, yet when deciding to reply 58% prioritize relevance/value and only 13% human authorship; 75% have blocked/muted/reported repeated outreach; 38% have replied only to make it stop ([Firmable via ContentGrip](https://www.contentgrip.com/firmable-ai-cold-outreach/)).
- Gartner (646 buyers, Aug–Sep 2025): 67% prefer a rep-free experience (up from 61% in 2024); 69% want to validate AI-generated insights with a rep; buyers rate GenAI (51%) and reps (49%) about equally likely to mislead ([Gartner](https://www.gartner.com/en/newsroom/press-releases/2026-03-09-gartner-sales-survey-finds-67-percent-of-b2b-buyers-prefer-a-rep-free-experience), [Gartner/BusinessWire](https://www.businesswire.com/news/home/20260520585188/en/)).
- Hunter State of Cold Email 2025 (217 decision-makers, 11M emails): average reply 4.1%; recipients "desensitized"; relevance and trust drive replies ([Hunter](https://hunter.io/the-state-of-cold-email-2025)). Instantly benchmark: average reply fell from 8.5% (2019) to 3.43% (2026) ([TechRound](https://techround.co.uk/artificial-intelligence/ai-broken-b2b-outreach-startups-adapting-winning/)).
- Trust shortcut: buyers are 5x more likely to engage a seller reached through a shared connection; 87% have a better impression when introduced via their network ([LinkedIn Sales Solutions](https://business.linkedin.com/sales-solutions/cx/20/09/build-trust-with-buyers)).

Documented tells (each with its source):
1. **Template openers / clichés** — "Reaching out", "I hope this email finds you well" rank as the most overused phrases in a 1M-email ZeroBounce study ([ZeroBounce via TBN](https://www.thailand-business-news.com/pr-news/study-reaching-out-tops-the-list-of-most-overused-email-buzzwords)); Gong: any opener other than a short specific nicety performs worse than none.
2. **Buzzwords, "AI", "platform", "all-in-one", ROI claims** — reduce replies (Gong 28M/85M; generic ROI −15%, Gong templates).
3. **"We"-heavy copy** — Waalaxy: ≥3 "we" drops reply from 16.3% to 12.6%; Gong: "we-we" language = pitching.
4. **Trigger-consequence hooks (funding, new hire, podcast)** — now recognized as automated; practitioners report fatigue ([Clay community](https://community.clay.com/x/general/msg_O4lU9E8u83fB/value-of-personalized-outreach-to-cold-contacts-am)). Gong 85M: personal-fact personalization ranks lowest; execs "don't care about alma mater."
5. **Over-personalization / fake familiarity** — details that signal private monitoring rather than public research (family, personal socials, assumed pain) read as creepy; reply rates rise with relevant context then fall once the prospect feels watched ([Hyperbound](https://www.hyperbound.ai/blog/cold-email-personalization-boundaries)). Gong: a wrong assumption is the fastest route to deletion.
6. **Guilt / pressure follow-ups** — "Thoughts?", "never heard back", "following up", "bubbling this up" harvest replies but cut meetings (Gong 304k). Hard CTAs in a first LinkedIn message cut "interested" replies by a third (Waalaxy).
7. **Length and polish** — anything >100 words (email) / >400 characters (LinkedIn) and 10th-grade+ prose (70% of cold emails, Lavender) reads as broadcast copy.
8. **Instant, always-perfect replies** — zero-latency, uniformly structured responses lower perceived humanness (Gnewuch 2018); the RL sales-agent literature explicitly measures and penalizes "identity detection" and inter-sentence repetition (§6).
9. **Discovery checklists in cold messages** — Gong exec data; MEDDIC questions asked aloud.

What builds trust: a specific, checkable observation about their business; a conditional claim ("if X is true for you, this may help" — Gong: conditions make claims more believable); an easy exit; an offer with standalone value; brevity; a mutual connection or peer reference.

---

## 6. Learning systems

- **Contextual bandits for message selection.** HubSpot's deep contextual bandit (Thompson sampling via learned-dropout Bayesian NN) was deployed "for marketing optimization problems at HubSpot" ([arXiv 1807.09809](https://arxiv.org/abs/1807.09809)); Wayfair's WayLift chooses whom/what/where/how-much with bandits ([Wayfair](https://aboutwayfair.com/careers/tech-blog/contextual-bandit-for-marketing-treatment-optimization)); causal/uplift bandits target only "persuadables" ([BibSonomy entry](https://www.bibsonomy.org/bibtex/757920f734ff069ba84df77110fa1503)). Limitations for an SDR: rewards arrive days later and are sparse (meeting booked), arms are open-ended text not a fixed menu, and reply rate is a corruptible proxy (see §2). Practical shape: bandit over *discrete policy choices* (CTA type, question-vs-observation, length band, follow-up type) conditioned on persona/stage, with meeting-booked (or positive-reply) as reward.
- **LLM-simulated buyers + RL.** DuCA (Dual-Horizon Credit Assignment) trains an industrial sales agent with multi-turn RL against a persona-conditioned LLM simulator, normalizing turn-level (fluency, compliance) and session-level (conversion) advantages separately: +6.82% relative conversion vs GRPO, −82% inter-sentence repetition, −27% "identity detection" (being spotted as AI) ([arXiv 2603.01481](https://arxiv.org/abs/2603.01481)). CustomerSim/SalesSim benchmarks LLMs as persona-faithful shopper simulators and finds **simulated buyers are over-persuaded by agent tone and drift from their persona**; UserGRPO raises decision alignment 0.417→0.652 ([arXiv 2605.08334](https://arxiv.org/abs/2605.08334)); Customer-R1 does the same for shopping behaviour ([arXiv 2510.07230](https://arxiv.org/abs/2510.07230)). Limitation: an agent optimized against a too-agreeable simulator learns pressure tactics that real buyers punish; simulators need calibrated skeptic/"not interested"/"send me info" personas with realistic refusal rates (Firmable's 1% "almost always reply").
- **Vendor data loops.** Lavender scores drafts A–F against its corpus; A-grade emails lifted replies 3.4→4.3% across 231,818 emails (+27%) ([Woodpecker review](https://woodpecker.co/blog/lavender-ai/)). Gong Labs mines its customers' email/call corpus for the correlational findings above. Both are correlational, vendor-selected, and email-centric; neither reports positive-reply or meeting outcomes consistently.

---

## (a) Method × fit × signature moves × failure mode

| Method | When it fits | Signature moves | Failure mode |
|---|---|---|---|
| SPIN | Discovery after a reply; operators/managers | Implication q; Need-payoff q | Question chains in cold touch; execs won't answer |
| Challenger | Senior, satisfied, has a vendor | Insight reframe; "most X assume…"; take control of next step | Generic "insight" = buzzwords; condescends juniors |
| Sandler | Skeptical/direct; after first reply | Up-front contract; "tell me more"; permission to say no | Full pain funnel in chat = interrogation; "how do you feel" |
| Gap Selling | Problem acknowledged, buyer will quantify | Current→future state; impact layer | Asking for numbers before trust |
| MEDDIC | Internal qualification/gating | Hidden-state checklist | Asked aloud ("who decides?") |
| Poke the Bear (Braun) | Cold/skeptical; "we're fine" | Neutral "how do you know…?"; label; detach | Poke that is a pitch in disguise |
| REPLY (Bay) | Any cold touch | Buyer-language problem statement; "you" focus; ≤100 words | Pitching, "we", ROI claims |
| SMYKM (McKenna) | High-value accounts, execs | Research-specific subject/opener; pre-empt objection | Personal-fact "research" (alma mater) |
| Lavender rules (Allred) | Every message | 25–50 words, grade 3–5, one easy question, mobile | >1 question; open-ended ask |
| 30MPC Miyagi | Any objection | Agree → disarm → redirect to a "test drive" | Arguing; ignoring "existing solution" class |
| Voss labeling / mimicry | First turns after reply | Tentative label; match register early | Late/obvious mimicry; mirroring hostility |

## (b) Testable conversation rules (source-tagged)

1. First LinkedIn message ≤300 characters; connection note ≤200; InMail <400 characters. [Waalaxy; LinkedIn]
2. Cold email body ≤100 words, 3–4 sentences; to C-level 50–100 words. [Gong 28M; Gong exec]
3. Exactly one question per message; it must be answerable in one line; no open-ended questions in touch 1. [Lavender; Gong templates]
4. No pitch in touch 1: no product name, "platform", "AI", "all-in-one", ROI %, or feature list. [Gong 28M/85M]
5. Touch-1 CTA is interest- or offer-based ("open to…?", "want the benchmark?"); never a time/calendar ask. [Gong CTA 304k; Waalaxy]
6. Switch to a specific time ask only after an explicit positive signal; include two concrete slots. [Gong CTA 304k]
7. Personalize on a business problem/priority/initiative; never on alma mater, hobbies, family, or personal posts. [Gong 85M; Hyperbound]
8. Every stated assumption is hedged ("as an outsider…", "if I've got this wrong…"). [Gong templates]
9. "You/your" ≥ "I/we"; ≤2 "I", 0–1 "we" per message. [Waalaxy; Gong 85M]
10. Opener is either a specific nicety tied to a real event or nothing; never "hope this finds you well"/"reaching out". [Gong templates; ZeroBounce]
11. Reading level grade 3–5; lowercase, short-phrase subject lines ≤4 words (email). [Lavender; Gong 85M]
12. Subject/first line must be useful even if they never buy. [Gong templates]
13. Follow-ups add new value; never "Thoughts?", "following up", "never heard back", or a bare bump. [Gong 304k]
14. Max 3 LinkedIn messages per thread without a reply (outreach, value follow-up, breakup); ≤6 touches over 14–28 days across channels, then stop. [Waalaxy; Gong 85M; Belkins]
15. Breakup message leaves the door open and offers a resource; no guilt. [Gong templates; Waalaxy]
16. Reply to a prospect reply within a human-plausible window: minutes to a few hours, varied by message length, never seconds. [Oldroyd/HBR direction; Gnewuch 2018; LinkedIn 65%/24h]
17. On "not interested": agree, then one disarming either/or question; if no answer, close politely. [30MPC; Braun]
18. On "send me info": agree, ask one narrowing either/or, send one specific asset, stop. [30MPC/skipcall]
19. On "we already use X": agree, then one neutral poke that only a current user could answer; no comparison claims. [Braun; 30MPC existing-solution]
20. On "what is this?": one plain sentence + one neutral question; no claims. [Gong exec; Braun]
21. On any opt-out or rudeness: single graceful exit line, write to suppression, no further touches. [Braun; Firmable; compliance]
22. Mirror register (formality, length, emoji, punctuation) in the first two turns after a reply; never mirror negativity; stop deliberate mimicry once rapport is set. [Swaab 2011; Ireland]
23. Use at most one tentative label per thread ("sounds like…"), only after they've said something with affect. [Lieberman 2007; Braun]
24. Budget ≤5 questions across the whole thread; alternate question → observation → question. [Gong 519k calls; Lavender]
25. Optimize on positive-reply / meeting-booked, never on raw reply rate. [Gong 304k vs 85M divergence; Waalaxy "interested" column]

## (c) Strongest quantitative findings

| Finding | Number | Source |
|---|---|---|
| Pitching reduces email reply rate | up to −57% | [Gong 28M, 2025](https://www.gong.io/blog/does-cold-email-even-work-any-more-heres-what-the-data-says) |
| Top 10% reps vs average | 8.1x meetings, 4.2x replies, 2.1x opens; 23 vs 3 meetings | Gong 28M; [Gong/30MPC 85M](https://tactics.30mpc.com/hubfs/The%20Ultimate%20Cold%20Email%20Data%20Report-1.pdf) |
| Average rep emails per meeting | 344 | Gong 28M |
| C-level reply vs non-exec | −30.2%; decide <3 s, read ≤9 s | [Gong exec](https://www.gong.io/blog/do-execs-really-reply-to-cold-email-here-s-what-the-data-says) |
| Interest CTA vs specific-time CTA (cold) | ~2x; specific CTA 15% cold → 37% in-deal; interest 25% in-deal | [Gong 304k](https://www.gong.io/blog/this-surprising-cold-email-cta-will-help-you-book-a-lot-more-meetings) |
| Generic bump follow-up | 15x less likely to book; "Thoughts?" −20% meetings; "following up" −5%; "hope all is well" (specific) +24% | [Gong 304k follow-ups](https://www.gong.io/blog/7-tips-for-writing-the-perfect-follow-up-sales-email-according-to-science) |
| Follow-up reply decay | 31% at touch 2 → 14% at touch 8; <0.5% after ~6 emails/28 days | Gong 304k; Gong 85M |
| Reading level | grade 3–5 → +67% replies; 70% of cold emails ≥10th grade; short+mobile +83% | [Lavender](https://lavender.ai/blog/cold-email-101) |
| InMail length | <400 chars +22%; >1,200 −11%; individually sent +15% vs bulk; 65% of replies within 24 h | [LinkedIn](https://www.linkedin.com/business/talent/blog/talent-strategy/these-inmails-get-best-response-rates) |
| LinkedIn message length | 1–300 chars 17.5%/4.2% interested vs 1,001+ 10.1%/2.2% | [Waalaxy 64M](https://images.g2crowd.com/uploads/attachment/file/1526002/_-E-book-Waalaxy-2025-_US_---Stat-prospection-Lkdn.pdf) |
| Hard CTA in first LinkedIn message | 19.0%→12.3% reply; 9.5%→6.0% interested | Waalaxy |
| Pronouns (LinkedIn) | "we" 0 → 16.3%, 3–5 → 12.6%, more → 9.5%; "I" 1–2 best | Waalaxy |
| Connection note | acceptance 27.6→25.3% (−) but post-accept reply 5.3→8.2% (+55%); 26.4 vs 26.4 / 9.4 vs 5.4 | [Belkins 2025](https://belkins.io/blog/sales-follow-up-statistics); [Belkins 20M via Expandi](https://expandi.io/blog/linkedin-connection-message-templates/) |
| LinkedIn follow-ups | 2 touches best; 1st follow-up adds ~0, 2nd +4.05% | Waalaxy; [Expandi](https://expandi.io/blog/linkedin-follow-up-message/) |
| Email follow-ups | 1st +49%, 2nd +9%, 3rd −20% replies; step 3 = 35.6% of meetings | Belkins 2023/2025 |
| Buyer deletion / AI distrust | 82% delete on sight; 63% mass-sent look = dealbreaker; 61% distrust AI outreach; 58% reply for relevance vs 13% for human authorship; 75% have blocked repeat senders | [Firmable, n=1,009](https://www.contentgrip.com/firmable-ai-cold-outreach/) |
| Rep-free preference | 67% (2025) vs 61% (2024) | [Gartner](https://www.gartner.com/en/newsroom/press-releases/2026-03-09-gartner-sales-survey-finds-67-percent-of-b2b-buyers-prefer-a-rep-free-experience) |
| Shared connection | 5x more likely to engage | [LinkedIn](https://business.linkedin.com/sales-solutions/cx/20/09/build-trust-with-buyers) |
| Text mimicry timing | early (first 10 min) mimicry improves mimicker's outcome via trust; late mimicry reverses | [Swaab et al. 2011](https://knowledge.insead.edu/leadership-organisations/mimicry-latest-negotiating-strategy) |
| Discovery questions | 11–14 per call optimal (519k calls) | [Gong](https://www.gong.io/resources/labs/nailing-your-sales-discovery-calls/) |
| RL sales agent vs simulator | +6.82% conversion, −82% repetition, −27% identity detection | [arXiv 2603.01481](https://arxiv.org/abs/2603.01481) |
| Simulated-buyer persona fidelity | 0.417 → 0.652 with UserGRPO; sims over-persuaded by tone | [arXiv 2605.08334](https://arxiv.org/abs/2605.08334) |
| Lavender A-grade | 3.4% → 4.3% reply (+27%, n=231,818) | [via Woodpecker](https://woodpecker.co/blog/lavender-ai/) |

Known gaps: no large-sample study isolates "I noticed"; no controlled evidence for Voss's tactics beyond affect-labeling neuroscience; no meta-analysis supports DISC-based adaptation; Ireland & Henderson's full LSM results were not accessible (secondary summary only); all outreach benchmarks are vendor data, mostly email.
