# human-labels.json — schema

Ships as `[]`. JSON can't hold comments, so the schema lives here instead. The owner fills in
~100 hand-labeled entries during LLM-judge calibration (Phase 2B, Task 6) — see
`packages/evals/src/judge/kappa.ts` (`runCalibration`, `cohensKappa`) and
`packages/evals/src/judge/judge.ts` (`judgeCopy`, the judge under calibration).

Each entry is a `HumanLabel` (type exported from `../../src/judge/kappa.ts`):

```json
{
  "draftId": "unique id for this labeled draft, e.g. a copy-corpus case id + variant",
  "draftText": "the exact outreach copy text a human rated",
  "grounding": "the citable-facts block the draft was written from (same shape the copy brains and the judge use)",
  "humanOverall": "integer 1-5 — the human rater's overall quality score, same 1-5 scale as JudgeVerdict.overall"
}
```

## Calibration procedure

`runCalibration(humanLabels)`:

1. Calls `judgeCopy({ text: draftText }, { grounding })` for every label to get the judge's own
   `overall` score.
2. Bins BOTH the judge's `overall` and the human's `humanOverall` to binary good/bad
   (`overall >= 4` = good — see the binning-decision comment on `binOverall` in `kappa.ts` for why
   binary, not the raw 1-5 scale, is the more robust choice for a small hand-labeled set).
3. Computes Cohen's kappa (`cohensKappa`) between the two binary series.

The judge stays **advisory-only** — nothing in the pipeline gates on it — until
`runCalibration(...).trusted` comes back `true`, i.e. `kappa >= 0.7` (`KAPPA_TRUST_THRESHOLD`).

## Filling this file

Pull ~100 real drafts (a mix of frozen corpus drafts and live-generated ones covers more ground
than one source alone), have a human rate each 1-5 on the same rubric the judge uses
(`JUDGE_PROMPT` in `judge.ts`), and append one `HumanLabel` object per rated draft to the array in
`human-labels.json`. Re-run `runCalibration` against the filled file once it has enough entries.
