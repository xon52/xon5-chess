# xon5-chess v1 Spec

## 1. Overview

xon5-chess is a browser chess app for playing against a computer opponent with a live sense of who is winning. The human plays Stockfish at a chosen strength, sees figurine move history and a live win% graph, and watches White/Black win probability update as the position changes.

## 2. Goals / non-goals

### Goals

- Human vs computer only (one human, Stockfish as opponent).
- Strength chosen at **New Game** via an Elo slider from **500–2000**, in steps of **50** (not adjustable mid-game; show the chosen Elo while playing).
- Live **win probability / advantage %** for White and Black, derived from Stockfish’s centipawn (or mate) score — shown only after both sides have played at least one ply.
- Interactive board with orientation flipped when the human plays Black.
- Move history as figurine notation in a horizontal strip (shown only when there is at least one move).
- A live win% graph over per-ply eval snapshots (title shows the current White / Black %), once both sides have played.
- Takeback / undo that always restores the human’s turn.
- Cleared start gate → **New Game** (color + Elo) → play; leave a game via **Resign** (with confirm) back to the cleared state.
- Pawn promotion UI including underpromotion (queen, rook, bishop, knight).

### Non-goals (v1)

- Clocks / timed games.
- Hints or best-move suggestions.
- PGN export/import.
- Local two-player or online multiplayer.
- Opening-book UI or a separate analysis board beyond live eval during play.
- Changing Elo mid-game.

App shell routes (Home, Play, Stats, About) are allowed; the **play contract** below still applies to `/play` only.

## 3. User flows

### Cleared / start gate

On load and after **Resign** (or any full reset that ends the session):

- No human color is chosen; the board is locked.
- Status reflects ready-to-play (not side-to-move as if a game were active).
- Hide win %, move list, and Elo display.
- Primary action: **New Game** only (no Resign / Undo).

### New game

Available only from the cleared state. The color/Elo chooser **replaces** the New Game button in place (Cancel returns to the New Game button without starting).

1. User picks color (White or Black) and Elo (500–2000, step 50). **Default Elo is 1200.**
2. On **Start**, begin from the standard initial position at that color and Elo.
3. Orient the board so the human’s side is at the bottom.
4. If the human is Black, the engine moves first as White.
5. Elo for this game is fixed until Resign / next New Game; show it read-only while the game is active. Do not offer a mid-game Elo control.

### Play

1. Human makes legal moves on the board (click or drag) **only when it is the human’s turn** and the game is not over.
2. On pawn promotion, show a chooser for **Q / R / B / N** (underpromotion allowed). The chosen piece is applied to the position and appears in SAN.
3. After a human move (when the game is not over), the engine searches for and plays a reply under the Elo-capped play budget.
4. Show live White % and Black % from the latest completed **eval** search (see §5 and §7) **only after both sides have played at least one ply** (history length ≥ 2). Display them as the title of the live win% graph. Before the first completed eval (once the graph is visible), show **50 / 50**.
5. Show a horizontal figurine move strip **only when history is non-empty**.

### Turn lock (board ↔ engine)

- **Human’s turn:** board accepts input; the engine must **not** run a play search. Eval search may run (see §5).
- **Engine’s turn / play search in progress:** board input is **locked** (no click/drag moves; dismiss or block promotion UI). Only **Undo** and **Resign** remain available as actions that can interrupt.
- Play search starts only when it is the engine’s turn (including engine-as-White at game start when the human chose Black).

### Takeback / undo

Undo **always** restores the human’s turn to move (when any undo is possible). Never leave the engine to move after an undo.

| Situation | Behavior |
| --- | --- |
| After human move + engine reply | Remove the last two plies (human + engine). Position and history match that earlier state. It is the human’s turn. Restore that position’s last known win% when one was recorded (§7); otherwise show **50 / 50** until a fresh eval completes. |
| Mid-engine-think (human has moved, engine searching) | Cancel the play search, then undo the human ply that triggered it. It is the human’s turn; no engine move is applied. Restore win% for the reverted position when known (§7). |
| After game over | Same undo rules as above (remove one or two plies as needed so the human is to move). Removing plies clears the terminal game-over state when the restored position is not terminal, so play can continue. |
| Pre-engine / local loop (human color already chosen) | Undo removes plies until it is the human’s turn again (typically one ply if only the human has been moving). |

Undo is a no-op / disabled whenever restoring the human’s turn is impossible: empty history (start as White), or only the engine’s opening ply (human as Black before they have moved). Never leave White to move with the human playing Black after an undo.

### Resign

While a game is active (human color chosen), primary actions are **Resign** and **Undo** (not New Game).

1. **Resign** shows a confirm step. Do not reset until the user confirms.
2. While resign confirm is open, **lock the board** (no moves) so history cannot change under the dialog.
3. On confirm, return to the **cleared / start gate** (starting position, no human color, board locked). Cancel leaves the game unchanged and unlocks the board if it is the human’s turn.
4. From the cleared state the user starts again with **New Game**.

### Game end

The game ends when `chess.js` reports:

- **Checkmate**
- **Draw by rules** that chess.js honors:
  - Stalemate
  - Insufficient material
  - Fifty-move rule
  - Threefold repetition

From a finished game, the user leaves via **Resign** (with confirm) back to the cleared state, then **New Game** — same path as abandoning an unfinished game. Undo remains available per the table above while the session is still active.

## 4. UI inventory

Play screen at **`/play`** (plus Home / Stats / About shell routes):

- Chess board (orientation: White at bottom when human is White; Black at bottom when human is Black).
- Side to move / game status (ready-to-play when cleared; playing / checkmate / draw reason when active).
- White % and Black % (whole numbers) as the title of a live win% graph — **hidden** until both sides have ≥1 ply; then **50 / 50** until the first completed eval. Graph: green when White is favored (>50%), red when Black is (<50%).
- **Elo:** slider only in the New Game chooser (500–2000, step 50; default **1200**); read-only display while a game is active.
- Move history (figurine SAN, horizontal scroll) — **only when history is non-empty**.
- **Cleared state:** **New Game** (opens in-place color + Elo chooser).
- **Active game:** **Resign** (confirm → cleared state) and **Undo**.
- **Promotion picker** (Q/R/B/N) when a promoting move is chosen.

Layout stays one composition focused on the board — not a multi-panel dashboard. Chooser / resign-confirm UI replaces the action button row in place.

## 5. Engine: one Stockfish, two jobs

Use a **single** Stockfish WASM instance in a Web Worker for both opponent play and live evaluation.

**Chosen binary:** npm package [`stockfish`](https://www.npmjs.com/package/stockfish) (Stockfish.js / Stockfish 18), **`stockfish-18-lite-single`** build. Rationale: small enough for a local chess app (~7MB), no SharedArrayBuffer / special CORS headers, still far stronger than needed when uncapped for eval, and supports modern UCI strength options. Do not ship the full multi-threaded build for v1.

### Mutex

- Only one search runs at a time.
- **Play search** runs only on the engine’s turn (never while it is the human’s turn).
- **While the engine is choosing a move**, any eval search is **stopped** (drain the stop `bestmove` before starting play). Hold the last displayed win% until play search finishes (or is cancelled). Board stays locked per §3.
- A newer **eval** for a different position **stops** an in-flight eval (same drain), then starts fresh — do not drop the new request.
- After a play move is applied (or after takeback cancels play search), **resume** eval search on the current position (human’s turn).

### Search budgets

| Job | Purpose | Budget |
| --- | --- | --- |
| Play | Choose the computer’s move | Elo-capped / strength-limited (see §6) |
| Eval | Score the position for win% | **`go movetime 500`** (500ms), **not** Elo-capped, so strength limiting does not poison the displayed evaluation |

## 6. Strength mapping (Elo 500–2000, step 50)

- The UI always speaks in **Elo** (500, 550, …, 2000). **Default: 1200.**
- Elo is chosen **once per game** in the New Game flow, stored on the game store (Pinia source of truth for M7 play searches), and stays fixed for that game. The value may be retained after resign as the default for the next New Game chooser; the UI shows it only while a game is active.
- **Preferred path** (expected with Stockfish 18 lite-single): for **play** searches only, set:
  - `UCI_LimitStrength` = true
  - `UCI_Elo` = the Elo chosen at New Game
  Eval searches do not use limit-strength Elo capping.
- **Fallback path:** if `UCI_LimitStrength` / `UCI_Elo` are unavailable in the loaded build, map Elo → **Skill Level** plus a depth and/or nodes cap for play searches. Document the mapping table in implementation notes; the product contract remains “roughly Elo 500–2000 in steps of 50.”

## 7. Evaluation UX and win% formula

- **Visibility:** Hide the win% UI until both sides have played at least one ply (history length ≥ 2). Do not show a vacant 50/50 graph on the cleared state or before the first full exchange.
- Once visible, primary display: **White %** and **Black %** as the graph title (Black % = 100 − White %), with a live chart of per-ply White % snapshots.
- **Initial display** (graph visible, no completed eval yet): **50 / 50** title and empty/pending chart until snapshots arrive.
- Win% derivation from a score is cheap; searching is not. Only convert the **latest completed eval** score (centipawns or mate). Do not run a second engine for percentages.
- While a **play** search is running, **hold** the last win% (do not update from play-search info lines).
- After eval search completes, update the percentages.
- **Per-position snapshots:** Store the latest completed eval White % keyed by move-history length. On undo to an earlier position, **restore** that position’s last known eval % (hold until a fresh eval completes). If that position was never evaluated, show **50 / 50**. Undo must not flash 50/50 when revisiting a previously evaluated line. The live graph plots these snapshots for plies ≤ current history length.
- Display as **whole-number** percentages (round half away from zero / normal rounding to nearest integer). After rounding White %, set Black % = 100 − White % so the pair always sums to 100.

### Formula

UCI `info score` values are from the **side to move** at the position being searched. Before applying the logistic, **normalize to White’s perspective**:

- Let `cp_stm` be the centipawn score from the engine (side to move).
- Let `cp` = `cp_stm` if White to move, else `−cp_stm`.
- Mate scores: interpret mate as a win/loss for the side to move, then map to White/Black (mate for the side to move → that color 100%; mate against the side to move → that color 0%).

\[
p_{\mathrm{White}} = \frac{1}{1 + 10^{-cp / K}}
\]

with locked constant **K = 400**.

| Score (after normalizing to White) | White % | Black % |
| --- | --- | --- |
| Mate for White | 100 | 0 |
| Mate for Black | 0 | 100 |
| `cp` (non-mate) | \(\mathrm{round}(100 \times p_{\mathrm{White}})\) | \(100 -\) White % |

## 8. Technical approach

| Concern | Choice |
| --- | --- |
| App shell | Existing Vue 3 + Vite + Pinia stack |
| Rules / game state | `chess.js` — legal moves, FEN, SAN history, game-over detection |
| Board UI | `@lichess-org/chessground` (thin Vue wrapper as needed) |
| Engine | npm `stockfish` → **`stockfish-18-lite-single`** in a Web Worker; play vs eval serialized per §5 |
| Routing | Vue Router: `/` Home, `/play` game, `/stats`, `/about`; Tauri opens on `/play` |

### State ownership

**Pinia is the source of truth; `@lichess-org/chessground` is a view; moves flow board event → store → FEN/config update.** The board must not own a divergent game state.

### Draw detection

Rely on `chess.js` for checkmate and for draws by stalemate, insufficient material, fifty-move rule, and threefold repetition.

## 9. Acceptance criteria

Observable behaviors for v1:

1. Default Elo is **1200**; choosing Elo **500**, **2000**, or a mid value (e.g. **1200**) at New Game configures the play-strength path from §6 for that game. Elo is not changeable mid-game; the chosen value is shown read-only while playing.
2. After a human move and engine reply, **Undo** restores the human’s turn and removes the last **two** plies from the position and move history.
3. **Undo** while the engine is thinking cancels the play search and restores the position from before the human’s last move (human to move; board unlocked).
4. **Resign** while a game is active (unfinished or finished) prompts for confirmation and does not return to the cleared state until confirmed; Cancel leaves the game intact. From the cleared state, **New Game** opens the color/Elo chooser (no mid-game New Game control).
5. Playing as **Black** shows the board with Black at the bottom; the engine moves first as White; the board is locked while that first search runs.
6. A promoting move offers **Q / R / B / N**; the chosen piece appears on the board and in SAN.
7. Win% is hidden until both sides have ≥1 ply; once visible and before any eval completes, win% shows **50 / 50**. For a completed non-mate eval, UCI side-to-move scores are normalized to White’s perspective, White % = \(\mathrm{round}(100 \times p_{\mathrm{White}})\) with **K = 400**, and Black % = 100 − White %; mate scores show **100/0** or **0/100**.
8. While the engine is picking a move, **no concurrent eval search** is running and the board is locked; play search does not run on the human’s turn; after the move is applied (or play search is cancelled), eval search resumes on the current position.
9. Checkmate ends the game; draws occur for stalemate, insufficient material, fifty-move, and threefold when those positions arise under `chess.js`.

## 10. Future / deferred

- Clocks and timed games.
- Hints / best-move display.
- PGN export or import.
- Local two-player and online play.
- Multi-route progress tracking / adaptive Elo (Stats persistence).
- Mid-game Elo adjustment.
- Click-to-seek / replay scrubbing on the win% graph.

## 11. Build milestones

Work the product in order below. Each milestone is one agent-sized step: a clear goal, a bounded file/surface, and an exit check. Do not start a later milestone until the previous one’s exit check passes. Acceptance criteria in §9 are cited where a milestone owns them.

### How to use these steps

- One milestone per agent session (or PR) unless two are trivially small and share the same surface.
- Prefer vertical slices that leave the app runnable after each step.
- Defer Stockfish until the local game loop (board + rules + undo / resign) works without an engine.

---

### M1 — Play shell

**Goal:** Replace the Vue template with a single play surface and empty control slots.

**Scope:**
- Strip counter/demo UI; keep Vue 3 + Vite + Pinia (+ optional one-route router per §8).
- One play view: board region, status, win%, Elo, move list, action placeholders per §4.
- Layout is one composition centered on the board (§4).

**Exit check:** `pnpm dev` shows the play shell; no chess logic yet. App builds and type-checks.

---

### M2 — Rules store (`chess.js`)

**Goal:** Pinia owns game state; moves are legal and history is SAN.

**Scope:**
- Add `chess.js`; create a game store as source of truth (FEN, turn, history, game-over flags).
- APIs for: apply move, undo ply(ies), reset/new game, read status (checkmate / draw reasons per §3).
- Unit tests for legal move rejection, SAN append, and terminal detection (mate + a couple of draw cases).

**Exit check:** Store can drive a full game in tests without a board. No engine. Maps toward §9.9.

---

### M3 — Board UI (`@lichess-org/chessground`)

**Goal:** Interactive board as a view over the store.

**Scope:**
- Thin Vue wrapper around `@lichess-org/chessground` (not the deprecated unscoped `chessground` package).
- Board events → store → FEN/config update (§8 state ownership).
- Click and drag legal moves; last-move / turn highlighting as Chessground defaults allow.
- Orientation prop wired (White bottom for now; Black orientation lands in M4).

**Exit check:** Human can play both sides locally on the board; illegal moves ignored; position stays in sync with the store.

---

### M4 — New game + color + orientation + resign shell

**Goal:** Start-gate New Game (color + Elo), Black orientation, turn lock, and Resign back to cleared.

**Scope:**
- Cleared start gate: no color, board locked, New Game only; hide win % and move list when empty / before both sides have moved.
- New Game in-place chooser: color + Elo slider default **1200**; `newGame` persists snapped Elo on the store (engine consumption in M7); Cancel does not mutate the store.
- After Start: show read-only Elo from the store; **Resign** + **Undo** (Undo may be wired lightly; full semantics in M6/M9). Resign confirm locks the board until Confirm/Cancel; Confirm → reset to cleared state.
- Board orientation flips when human is Black.
- If human is Black, after start it is White’s turn (engine reply comes in M7; prefer an engine stub hook so M7 plugs in). Board should not accept human moves on the engine’s turn.

**Exit check:** Resign confirm blocks discard; Black games show Black at bottom; start position correct; human cannot move on engine’s turn; cleared UI matches §3/§4. Maps to §9.4, §9.5 (engine-first ply deferred to M7).

---

### M5 — Promotion picker

**Goal:** Promoting moves require Q/R/B/N choice, including underpromotion.

**Scope:**
- Intercept promotion moves from the board; show picker; apply chosen piece to store and SAN.
- No default-to-queen without UI.

**Exit check:** Promote to each of Q/R/B/N; piece and SAN match. Maps to §9.6.

---

### M6 — Undo (always human’s turn)

**Goal:** Undo always restores the human’s turn.

**Scope:**
- With human color chosen: undo removes plies until it is the human’s turn (typically one ply pre-engine; two after a full exchange). Drive the invariant off side-to-move + human color (including through terminal positions), not “human may move now.”
- Disable when undo cannot restore the human’s turn (White at start; Black after only the engine’s first ply). A failed undo must not partially mutate position/history.
- After game over (mate or draw), undo clears terminal state when the restored position is non-terminal so play can continue.
- Leave cancel-mid-search behavior for **M9**.

**Exit check:** Undo never leaves the engine (or “other”) side to move when human color is set; failed undo leaves the store unchanged; history and FEN match. Maps toward §9.2, §9.3 (engine cases in M9).

---

### M7 — Stockfish worker + play moves + Elo

**Goal:** One WASM Stockfish in a Web Worker plays replies at the chosen strength.

**Scope:**
- Add npm `stockfish`; load **`stockfish-18-lite-single`** in a worker (§5).
- After a human move (game not over), lock the board, run a **play** search, apply the best move, unlock for human.
- Elo from New Game (500–2000 step 50, default 1200) → `UCI_LimitStrength` / `UCI_Elo`; fallback Skill Level path only if needed (§6). No mid-game Elo control.
- Human-as-Black: engine moves first as White after New Game (board locked during that search).
- Play search never starts on the human’s turn. Mutex skeleton: only one search at a time (eval comes in M8).

**Exit check:** Full human-vs-computer games at 500, 1200, and 2000; Black-first engine ply works; board locked while engine thinks. Maps to §9.1, §9.5.

---

### M8 — Eval search + win%

**Goal:** Live White/Black % from a 500ms eval budget; play and eval never overlap.

**Scope:**
- Eval searches with **`go movetime 500`**, not Elo-capped (§5, §7).
- Show win% UI only after both sides have ≥1 ply; while play search runs: stop eval (drain stop `bestmove`); **hold** last win% (initial **50 / 50** until first completed eval once visible); do not update from play info lines.
- A newer eval **preempts** an in-flight eval (stop + drain, then search the current position) — do not drop the request.
- After play move applied (or later when M9 cancels play): resume eval on the current position.
- Store completed eval White % per history length; on undo, restore the snapshot for that position (§7).
- Normalize UCI **side-to-move** scores to White’s perspective; K = 400; round to whole-number %; mates → 100/0 or 0/100 (§7).

**Exit check:** Win% hidden then visible per §7; updates only from completed eval; holds during computer think; 50/50 before first eval once shown; undo restores prior snapshot when known; formula matches §7. Maps to §9.7, §9.8.

---

### M9 — Engine-aware undo

**Goal:** Undo matches the full §3 table with an in-flight engine.

**Scope:**
- After human + engine reply: undo removes both plies; human to move; restore win% snapshot for that position; resume eval in the background.
- Mid-engine-think: cancel play search, undo the human ply, unlock board; restore win% snapshot when known; resume eval.
- Keep “always human’s turn” invariant.

**Exit check:** Undo matches §3 including mid-search. Maps to §9.2, §9.3.

---

### M10 — Acceptance pass + polish

**Goal:** Close §9 and ship a coherent v1 play screen.

**Scope:**
- Walk every acceptance criterion; fix gaps.
- Status copy for ready / playing / checkmate / draw reason; conditional move list and win%; disabled Undo at start of a game; Resign confirm from finished or unfinished games.
- Light visual polish within the existing one-composition layout (no extra routes or deferred features from §10).
- Smoke: type-check, unit tests, manual playthrough of §9.

**Exit check:** All nine acceptance criteria observable; no known blockers for play.

---

### Milestone dependency graph

```text
M1 Play shell
 └─ M2 Rules store
     └─ M3 Board UI
         ├─ M4 New game / color / orientation / resign
         ├─ M5 Promotion
         └─ M6 Undo (always human’s turn)
             └─ M7 Stockfish play + Elo
                 └─ M8 Eval + win%
                     └─ M9 Engine-aware undo
                         └─ M10 Acceptance pass
```

M4–M6 can be sequenced as listed (recommended) or swapped among themselves after M3 if an agent prefers promotion or undo before New Game — but M7 must follow a working local loop, M8 must follow M7, and M9 must follow M8.
