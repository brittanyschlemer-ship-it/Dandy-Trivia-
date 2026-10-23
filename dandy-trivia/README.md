# Dandy Trivia

Live multiplayer trivia for a remote team. One host creates a game, shares a link, everyone joins with just a name, and the server runs the 15-second rounds, scoring and leaderboard.

**Status: built and tested locally, not deployed.** I had no hosting access, so there is no public URL yet. Follow "Get a public link" below; it takes about 5 minutes.

## Quick start (local)

```bash
npm install
npm start            # http://localhost:3000
```

Open `http://localhost:3000`, create a game, and open the shared link in other tabs or devices to play. Players on other networks need a public URL (next section).

## Get a public link

Pick one. All of them just run `node server.js`; no database account or API keys are needed.

**A. Render (simplest permanent option)**
1. Push this folder to a GitHub repo.
2. In Render: *New > Blueprint*, select the repo. `render.yaml` configures everything.
3. When it finishes you get `https://dandy-trivia-xxxx.onrender.com`. Share that.
4. Free plan? Delete the `disk:` block and `DATA_DIR` from `render.yaml`. Games work the same, but a restart ends any game in progress, and free instances sleep when idle (open the site a minute before your meeting).

**B. Railway / Fly.io / any Docker host**: a `Dockerfile` is included. Set `PORT` if the platform asks, and mount a volume at `/data` if you want games to survive restarts.

**C. Same-day, from your laptop**: run `npm start`, then `npx cloudflared tunnel --url http://localhost:3000` (or `ngrok http 3000`). Share the `https://` URL it prints. Keep your laptop awake and the terminal open during the game.

WebSockets must be allowed (they are on all the platforms above). Use `https`; the app switches to `wss` automatically.

## Hosting a game

1. Open the site, enter your name, leave "I'll play too" ticked (or untick it to just run the show), pick a length, **Create game**.
2. In the lobby, **Copy link** and paste it into your meeting chat. Open *Game settings* to choose categories, difficulty and length.
3. Watch players appear. When everyone's in, press **Start game** in the bar at the bottom.
4. Each question runs 15 seconds. When the clock hits zero everyone sees the answer, an explanation and the leaderboard. Press **Next question** when ready (it unlocks after 5 seconds). **End game** finishes early.
5. On the final screen, **Play again** keeps the same players and resets scores; **New game** starts fresh.

Notes: your host powers live in a secret token stored in *your browser*. Refreshing is fine. Don't clear site data, and don't open the link as a player in the same browser profile (it will see you as the host); use a private window instead. If you lose the token you lose host control of that game, so just start another.

## Playing

Open the link, type a name, wait in the lobby. Tap an answer (or press 1-4 / A-D). Your first tap locks in. Correct = 500 points, and the fastest correct answer gets 1,000. If you refresh or lose signal, reopen the same link and you're back with your score. Joining mid-game is allowed; you sit out the question in progress and play from the next.

## How it works (and why it can't be gamed)

A single Node server (`server.js`: Express + `ws`) owns all game state. Browsers only send intentions ("join", "answer 2"); the server decides everything else.

| Rule | Where it is enforced |
|---|---|
| Only the host can start/advance/end/restart/kick/change settings | Every host message must carry the secret host token; the server compares its SHA-256 hash in constant time. Tokens are never sent to other players. |
| 15-second countdown | Server sets `deadline = start + 15000ms` and fires the reveal itself. Clients get the deadline and align to the server clock with ping/pong offset sampling, so all screens count down together. Client timers only draw the ring. |
| Late answers rejected | `answer` is refused if server time ≥ deadline or phase ≠ question. |
| One answer per player | First submission locks; later ones are refused with `duplicate`. |
| Correct answer hidden until reveal | The view builder omits `correctIndex`, explanation and source until phase = reveal. Option order is shuffled server-side per game. |
| Scoring and "first" | Server timestamps each accepted answer (`Date.now()` on arrival, plus arrival sequence for ties). First correct = 1,000, other correct = 500, else 0. Computed once at reveal. |
| Winner | Highest score, then most correct answers, then lowest average response time. |
| Identity | Each player gets a secret token in `localStorage`; refresh/reconnect re-attaches to the same player and score. Names are unique (case-insensitive), max 20 chars, and rendered as text, never HTML. |
| Host drops | The timers are server-side, so rounds resolve without the host. Players see "host disconnected" and the game waits at the reveal until the host returns (unless auto-advance is on). |
| Restarts | State is saved to `DATA_DIR/games.json` and restored on boot; running questions resume against their original deadline. Games expire after 24h idle. |

Also: payloads capped at 4 KB, 30 messages/second per socket, game creation limited to 10/minute per IP, 150 players per game, CSP and security headers set.

### Why not Supabase/Firebase?
Your brief offered them as examples. A single authoritative Node process gives exact control of timing, ordering and permissions with nothing to configure, and it deploys anywhere. The trade-off: one server instance (fine for a team, not horizontally scalable), and persistence is a JSON file rather than a hosted database. If you later need multi-instance scale, the game logic is isolated in `server.js` and the state shape is below.

### State shape (the "schema")
```
Game { code, createdAt, updatedAt, hostHash, settings{numQuestions, categories[], difficulties[], autoAdvance},
       phase: lobby|question|reveal|final, qIndex, startedAt, deadline, revealAt,
       questions[{id, category, difficulty, text, options[4], correctIndex, explanation, source}],
       players{ id: {id, name, key, tokenHash, isHost, score, correct, totalMs, answeredCount, joinedAt, joinedAtQ} },
       answers{ playerId: {choice, at, elapsed, seq} }, reveal{correctIndex, results{}, distribution[4], fastest}, lastRanks{} }
```
Tokens are stored only as SHA-256 hashes.

## Question bank

`data/questions.json`: **139 questions**, 28 easy / 78 medium / 33 hard, across Dandy Acronyms, Dental Terms, Teams & Workflows, Business Lingo, Company Facts, Products & Digital Dentistry, Culture & Fun. Each has one correct answer, three wrong options, an explanation, category, difficulty and a source. Options are shuffled at game start so the answer isn't always in the same slot.

- Review sheet with every answer and source: `docs/QUESTION_BANK.md` (⚠ marks questions resting on Slack or a headline-only/secondary source; worth a 2-minute skim).
- To edit: change `scripts/build_questions.py` and run `npm run build:questions`, or edit the JSON directly (keep the same fields). Restart the server to load changes.

### What I could and couldn't verify
- **Glossary PDF (primary source):** all acronym/term answers come straight from it. Slack cross-checks were limited to a handful of terms (DANTE, DDE, DDP) because Slack mostly contains people *asking* what acronyms mean, not definitions. Most acronym answers therefore rest on the glossary alone. Where the glossary reads oddly (for example it expands COGS as "Cost of Goods and Services"), I left the question out rather than guess.
- **Slack:** accessed read-only, public channels only (no private channels or DMs). Used for the calendar-phishing warning, the NetSuite "north star" post, the Vision/Trios scan-mesh analysis and the DANTE/DDE cross-checks. These are internal chatter, so please confirm you're comfortable using them with the whole team.
- **meetdandy.com:** direct page fetches were blocked (Cloudflare 403), so I did **not** browse the site. I used web-search excerpts of its pages and press releases (home, /labs, /careers, newsroom) plus Dandy's LinkedIn. Facts like "Lehi UT / Carrollton TX", "2-appointment dentures", "2 million people" and press-release figures are as of those excerpts and could have changed; the leadership questions are worded "in the April 2025 release" for that reason. The Fusion denture line and Yeshiva partnership come from news headlines only.
- I left out anything I could only find in a single third-party article (founders, funding rounds, acquisitions).

## Tests

```bash
npm test            # server integration: ~1 minute (includes a real 15s round)
npm run test:fast   # same without the real-time round
npm run test:ui     # runs the real client code in jsdom against the live server
npm run test:load   # 60 simultaneous players
```
Last run: server integration 64/64 (57 fast + 7 real-timer), UI 30/30 (repeated 5x clean), load check passed. They cover: shared link joining, live lobby, duplicate names, host-only start/advance (forged tokens rejected), identical server deadline for all clients, 15s timing (reveal at 14.99s; reveal spread <150ms across clients), answer locking, late-answer rejection, no answer leakage before reveal, 1,000/500/0 scoring, first-correct ordering, leaderboard, reconnect and host-refresh recovery, host-offline handling, late joiners, tie-break ordering, end early, play again, restart persistence, and the create/join/question/reveal/final screens driven through real DOM events.

### Limitations (please read)
- **Not deployed.** No public URL exists until you do the deploy step above.
- **Not tested in real browsers or on phones.** This environment has no browser. The UI was exercised in jsdom (logic and DOM), which can't judge visual layout, fonts, animation smoothness, or real touch behaviour. The CSS is built mobile-first and responsive, but please open it on a phone and a desktop once before the meeting. Run a 2-minute dry run with a colleague.
- **Branding is inspired, not matched.** I couldn't view meetdandy.com visually, so colours, type and logo mark are my own Dandy-flavoured choices, not official brand assets. Swap the CSS variables at the top of `public/style.css` (and the inline logo in `app.js`) to align with brand guidelines.
- Fonts load from Google Fonts; if blocked, system fonts are used.
- Single server instance; in-progress games are lost on a restart if you have no persistent disk.
- Response-time fairness is measured at the server, so players with slower connections can lose "first" by network latency. That's inherent to the specified scoring.
- Average response time counts every question a player answered (right or wrong).
