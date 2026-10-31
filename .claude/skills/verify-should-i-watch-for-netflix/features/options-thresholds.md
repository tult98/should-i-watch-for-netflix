# Quick badge thresholds

Three cards (MAL for anime, IMDb for movies and series, TMDB when there is no IMDb score) hold the limits behind the verdict badge: score, vote and rank minimums for Highly recommended, Recommended, Maybe, and a few-votes warning. A valid edit saves, a bad value is rejected inline, and Reset restores the defaults.

## Sub-features

- `threshold-save` stores a valid edit.
- `threshold-validate` rejects an empty, non-numeric or out-of-range value and stores nothing.
- `threshold-reset` restores and saves the defaults.
- `threshold-apply` makes the next hover use the new limits (Netflix, not driven here).

## How to get to it (user POV)

- Options page, cards titled `Quick badge thresholds · Anime (MAL)`, `… (IMDb)`, `… (TMDB, when there is no IMDb)`.
- Harness: `s.url('options.html')`, scoped to `section.thresholds-mal`, `-imdb`, `-tmdb`.

## Driving it with playwright-core

Preconditions:

- Baseline from `README.md`. The MAL card shows the defaults (Highly score 8, votes 100000, rank 500).

- **Run the whole recipe.** `node .claude/skills/verify-should-i-watch-for-netflix/scripts/scenarios/options-thresholds.mjs`. Eight `PASS` lines, clip, `PACING OK`.
- **Valid edit.** `await s.type(page.locator('#th-mal-highlyScore'), '8.5', ...)` then click `Save thresholds` inside `section.thresholds-mal`. Status `Saved`, and `settings.thresholds.mal.highly.score` is `8.5`.
- **Invalid edit.** Type `11`, click `Save thresholds`. `#th-mal-highlyScore` gets `aria-invalid="true"`, `#th-mal-errors` lists a message with `between 0 and 10`, and storage still holds `8.5`.
- **Reset.** Click `Reset to defaults`. Status `Reset to defaults`, the input reads `8`, `aria-invalid` is gone, storage holds `8`.
- **Proof.** `shots/options-thresholds-{saved,invalid}.png`, `video/options-thresholds.webm`.
- **Other sets.** The same field ids exist per set: `#th-imdb-<field>`, `#th-tmdb-<field>`. Fields: `highlyScore`, `highlyVotes`, `rankMax` (MAL only), `recommendedScore`, `recommendedVotes`, `maybeScore`, `lowVotesBelow`. Not yet driven.

## Gotchas

- Scores accept 0 to 10, votes and rank whole numbers. An empty rank is allowed (turns the rule off), every other field is required.
- A rejected save leaves the old stored value. Assert storage, not only the error text.
- `Reset to defaults` saves immediately, it is not a draft.
- The status text `Reset to defaults` and the button label are identical. Scope the status wait with `getByRole('status')`.
