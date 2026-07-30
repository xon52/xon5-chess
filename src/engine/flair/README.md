# Flair engine

Flair is a **human-like** play engine. It does not use Stockfish Skill Level.
Instead it:

1. Builds a short list of moves a player at that level might “look at”
2. Scores those moves deeply with Stockfish (honest centipawn / mate eval)
3. Labels each move by **how much worse it is than the best** (swing)
4. Rolls a quality bucket from level weights, then picks a move in that bucket

Eval bar / win% still uses the separate full-strength Stockfish eval path.

## Pipeline

```text
FEN + recent moves
        │
        ▼
┌───────────────────────┐
│ 1. Candidate list     │  shallow MultiPV (candidateDepth)
│    + takebacks /      │  merge with recency-ranked legals
│      recency fills    │  always keep recaptures onto last.to
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ 2. Deep score         │  MultiPV at scoreDepth
│                       │  restricted via UCI searchmoves
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ 3. Classify           │  swingCp = moveCp − bestCp (side-to-move)
│                       │  → brilliant / great / good / poor /
│                       │     mistake / blunder
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ 4. Sample             │  weighted quality roll (renormalize if
│                       │  a bucket is empty), then pick in-bucket
│                       │  (recency-weighted for good bands;
│                       │  least-bad for mistake/blunder)
└───────────────────────┘
```

Human moves are classified the same way for console calibration logs, but on a
**full-board** deep MultiPV (`FLAIR_ANALYSIS`), not the shallow candidate list.

## Files

| File | Role |
|------|------|
| `configs.ts` | Levels, weights, depths, recency bias, classify thresholds |
| `play.ts` | Play pipeline: candidate → score → classify → sample |
| `analyze.ts` | Human-move MultiPV classification |
| `classify.ts` | Swing → quality buckets |
| `sample.ts` | Weighted bucket roll + in-bucket pick |
| `recency.ts` | Tunnel vision / takeback scoring |
| `log.ts` | Console move logs + end-of-match early/mid/end stats |

The app-facing API is `createChessEngine(backend)` / `getEngine()` in
`src/engine/` (play + eval + analyze on one facade).

## Quality labels (`swingCp`)

`swingCp` is side-to-move centipawn vs the best MultiPV line (mates mapped to
large ±sentinels). Thresholds live in `FLAIR_THRESHOLDS`:

| Quality | Swing (cp) |
|---------|------------|
| **brilliant** | `≥ 0` and gap to 2nd best `≥ brilliantGapCp` (150) |
| **great** | `≥ greatMinSwing` (−25), not brilliant |
| **good** | `≥ goodMinSwing` (−55) |
| **poor** | `≥ poorMinSwing` (−90) |
| **mistake** | `≥ mistakeMinSwing` (−300) |
| **blunder** | `< mistakeMinSwing` |

Tweaking thresholds changes how often buckets fill, not how often they are
chosen. Wider “great/good” bands → more strong-looking moves available;
stricter blunder floor → fewer true disasters labeled blunder.

## What to change for difficulty

All of this is in [`configs.ts`](./configs.ts).

### 1. Quality weights (main personality)

Per level: `{ brilliant, great, good, poor, mistake, blunder }`.

Sampling is a **waterfall** (brilliant → great → … → blunder):

1. Skip empty tiers (and zero-weight tiers).
2. At each remaining tier, stop with  
   `P = w[tier] / sum(w[remaining non-empty tiers])`.
3. Otherwise fall to the next best tier.

So a missing brilliant does **not** dump probability into mistake — it falls to
great/good. Higher `brilliant` weight = more often take a unique shot **when
that bucket is non-empty**.

| Goal | Tweak |
|------|--------|
| Weaker / more “meh” | ↑ `poor`, ↓ `great` / `good` |
| Stronger / more accurate | ↑ `great` / `good`, ↓ `poor` / `mistake` |
| Take brilliancies more often | ↑ `brilliant` (Expert+ ramp) |
| Fewer meltdowns | ↓ `blunder` (and somewhat `mistake`) |

### Level ramp (weights; waterfall among non-empty)

| Level | brilliant | great | good | poor | mistake | blunder | multipvCap |
|-------|----------:|------:|-----:|-----:|--------:|--------:|-----------:|
| Beginner | 0 | 3 | 16 | 55 | 22 | 4 | 6 |
| Novice | 2 | 12 | 35 | 34 | 14 | 2 | 6 |
| Club | 5 | 28 | 40 | 17 | 9 | 1 | 6 |
| Solid | 10 | 45 | 32 | 8 | 5 | 0 | 5 |
| Expert | 28 | 58 | 12 | 2 | 0 | 0 | 3 |
| Master | 50 | 48 | 2 | 0 | 0 | 0 | 3 |
| Grandmaster | 100 | 1 | 0 | 0 | 0 | 0 | 3 |

Candidate / score depth also ramps at the top (Master 10/12, GM 12/14). GM sets
`preferBest` so in-bucket picks are highest swing (≈ Stockfish best among the
MultiPV set), not a random near-equal “great”.

### 2. `candidateDepth` vs `scoreDepth`

| Knob | Meaning |
|------|---------|
| **`candidateDepth`** | How deep Stockfish looks when building the “moves I consider” list. Beginner/Novice use **1** (tunnel / short tactics). Higher levels raise this toward full board. |
| **`scoreDepth`** | How deep those candidates are scored for CP/swing. Stay high (**8**) so labels stay honest. |

Do **not** lower `scoreDepth` to weaken play — that just mislabels moves.
Weaken via weights / recency / shallower candidates instead. Raise Master/GM
`candidateDepth` + `scoreDepth` when you want them closer to full Stockfish.

### 3. `recencyBias` (0–1)

How much in-bucket picking favors recent activity (takebacks onto `last.to`,
continuing the piece that just moved, nearby squares).

| Level idea | Bias |
|------------|------|
| Early beginner tunnel vision | ~0.9 |
| Seeing more of the board | 0.4 → 0.2 |
| Whole-board / multi-step | ~0 |

Also: legal **recaptures** are preferred in the candidate list, but at least one
shallow engine line is always reserved when MultiPV is tight (so a low
`multipvCap` cannot become takeback-only).

**Caveat:** Recency only affects the pick *inside the rolled quality bucket*.
If the roll is `mistake`, a great takeback will not be chosen that ply.

### 4. `multipvCap`

Max candidates to score (floored at `FLAIR_MIN_MULTIPV_CAP` = 3 so takebacks
cannot starve the engine line). Higher = more chances of bad lines in MultiPV
(more mistake/blunder buckets filled). Lower = fewer trash options, play feels
stronger when bad buckets empty and weights renormalize upward. Top levels stay at the floor and separate via weights, depth, and GM’s
`preferBest` instead of ever-tighter MultiPV.

## Console calibration

With Flair selected, DevTools shows:

```js
[flair] { side: 'human'|'computer', quality, move, swingCp, score, inBucket }
```

At game end:

```js
[flair] match stats { human: { early, mid, end, overall }, computer: { … } }
```

Phases are thirds of each side’s sampled moves (`only-legal` /
`outside-multipv` are skipped in the %).

## Known gaps (not knobs yet)

- **Shiny-things / hanging-piece bait** — beginners often grab free-looking
  material even when pressing is better. Recency does not cover baits far from
  the last fight; that would need a separate capture bias.
- **Missed takeback with a mistake roll** — personality weights can override
  recency for that move.
- **Late-game collapse** — when MultiPV is only bad lines, mistake/blunder
  fire more; mistake/blunder picks use **least-bad** in-bucket to avoid random
  suicide among trash.

## Ladder simulation

Manually check that a lower Flair level rarely beats the next level up:

```bash
pnpm simulate
pnpm simulate -- --games=8
pnpm simulate -- --games=4 --pairs=beginner:novice,club:solid
pnpm simulate -- --max-upset=0.25
```

Defaults: 4 games per adjacent pair (colors alternate), fail if lower wins
more than 35% of games in any pair. Uses a Node Stockfish WASM backend
(`scripts/nodeStockfishInternal.ts`) — not the browser Worker. Expect a long
run; each ply is two MultiPV searches.

## Quick recipes

**“Beginner takes more recaptures”**  
Raise `recencyBias` slightly and/or ensure takebacks stay in candidates
(`recency.ts`). Also lower `mistake` so rolls land in poor/good more often.

**“Beginner less suicidal at the end”**  
Lower `blunder` / `mistake`; keep least-bad sampling (already on).

**“Beginner too strong in the opening”**  
Lower `great`, raise `poor`; keep `candidateDepth: 1`.

**“Club feels like soft 1400”**  
Shift Club weights toward more `great`/`good`, less `poor`; raise
`candidateDepth` a bit; lower `recencyBias`.

**“Master too soft / GM too big a jump”**  
Push Master/GM `great` up and cut `good`/`poor`/`mistake`; lower `multipvCap`
so fewer trash lines enter the roll. Keep a little `good` on GM so it is not
best-move-only Stockfish.
