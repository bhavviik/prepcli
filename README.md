# prepcli

Persistent AI collaboration layer — structured prompts, project context, and decision records for Claude, Cursor, Windsurf, and more.

---

## What it does

Most AI coding sessions start cold. The AI asks what your stack is. It suggests something you ruled out last week. It doesn't know about the deployment freeze. You spend the first 10 messages re-explaining context that hasn't changed.

prepcli fixes this in three layers:

**Layer 1 — Structured prompts.**
Six workflow slash commands (`/debug`, `/plan`, `/prep`, etc.) that ask targeted questions before the AI starts working. Better questions → better output on the first attempt → less back-and-forth.

**Layer 2 — Project context.**
`prepcli init` scans your codebase, stores your stack and constraints in the cloud, and silently injects them at the start of every AI session. The AI already knows your stack, your hard limits, and what was decided last week — without you saying a word.

**Layer 3 — Decision records.**
Every AI session gets recorded as a structured Markdown document: what was done, why, what was ruled out, linked to the git commit. Records live in a hidden git branch that travels with every clone. No account needed to read history. Works offline.

---

## Quick start

```bash
npm install -g prepcli
prepcli install        # copy workflow files to your AI tool
prepcli auth login     # create free account (optional — enables cloud features)
prepcli init           # scan project, push context, set up shadow branch
```

Open your AI tool and type `/debug`, `/plan`, or any workflow command.

---

## Workflow commands

| Command | What it does |
|---|---|
| `/prep` | Universal session starter — ask targeted questions, build a structured prompt, execute on approval |
| `/debug` | Turn a vague bug report into a precise debugging prompt |
| `/plan` | Gather product and technical constraints, build a planning prompt |
| `/refactor` | Gather constraints for a safe refactor |
| `/review` | Gather review intent and constraints, build a focused code review |
| `/write` | Gather audience and constraints, build a precise writing prompt |

Each workflow follows the same structure:
- **STEP 0** — silently reads project context before asking anything
- **STEP 1–4** — asks one question at a time to fill critical gaps
- **STEP 5** — builds and shows a structured prompt, executes on your approval
- **FINAL STEP** — silently records what was done to the local session file

---

## Project context

Run once per project:

```bash
cd your-project
prepcli init
```

prepcli scans your codebase (reads `package.json`, lock files, config files, git remote) and asks three questions:

1. **Hard limits** — things AI must never do (`never add console.log to production`)
2. **Active constraints** — things that are true right now (`auth module is frozen until Dec 15`)
3. **Conventions** — patterns AI would get wrong (`use AppError class, never throw raw strings`)

This context is pushed to the cloud and injected silently at the start of every AI session via STEP 0. The AI knows your stack, your limits, and your conventions without you repeating them.

```bash
prepcli context             # show current context
prepcli context --preview   # show exactly what STEP 0 injects
prepcli context --edit      # open in $EDITOR and push changes
```

Stack detection covers: language, runtime, framework, database, auth, testing, API layer, styling, monorepo, i18n, CI, hosting, package manager.

---

## Decision records

After every AI session, `prepcli` records what was done, why, and what was ruled out — linked to the git commit it produced.

### How recording works

During a session, the AI silently runs after each task:

```bash
prepcli session add \
  --workflow=debug \
  --what="replaced date-fns with custom UTC offset handler" \
  --why="date-fns fails silently on UTC+5:30 half-hour offsets"
```

This writes to a local `.prepcli-session` file — no network, no auth, works offline.

When you run `git push`, a pre-push hook fires:

```
[prepcli] 2 AI turns this session:
  [debug]  identified date-fns as root cause
  [debug]  replaced with custom UTC offset handler

  Final summary? (Enter to skip): _
```

Type a one-line summary and press Enter. The push is never blocked — Enter skips recording entirely.

### Where records live

Records are stored in two places:

| | Shadow Branch | Database |
|---|---|---|
| **Content** | Full Markdown — all turns, alternatives, constraints | Lean JSON — summary, key files, turn count |
| **Needs account** | No | Yes |
| **Works offline** | Yes | No |
| **Travels with clone** | Yes | No |
| **AI reads at STEP 0** | No | Yes — feeds `recent_decisions` |

The shadow branch (`prepcli/shadow/v1`) is an orphan git branch — completely separate from your code history. It travels with every `git clone` and every `git fetch`.

### Reading records

```bash
prepcli log                        # last 10 decisions
prepcli log --workflow debug       # debug sessions only
prepcli log --file src/auth.js     # decisions touching this file
prepcli log --commit abc123        # specific commit
```

Or directly with git — no prepcli needed:

```bash
git show prepcli/shadow/v1:20260524-dec-a3f9c2b1.md
```

### How decisions get recorded

There are two ways a decision lands in `prepcli log` — by the AI automatically, or by you manually.

**Recorded by AI (automatic)**

After every AI task, the workflow silently runs:

```bash
prepcli session add \
  --workflow=debug \
  --what="replaced date-fns with custom UTC offset handler" \
  --why="date-fns fails silently on UTC+5:30 half-hour offsets"
```

Turns accumulate locally in `.prepcli-session`. When you run `git push`, the pre-push hook fires:

```
[prepcli] 2 AI turns this session:
  [debug]  identified date-fns as root cause
  [debug]  replaced with custom UTC offset handler

  Final summary? (Enter to skip): rebuilt calendar with custom timezone handling
```

Type a one-line summary and press Enter. One decision record is written to the shadow branch covering the full session.

---

**Recorded manually**

You don't have to wait for an AI session or a push. If you discover something — a production bug, an architectural decision made in a meeting, a constraint found in docs — record it immediately.

```bash
prepcli record
```

```
[prepcli] Recording decision

What did you decide or discover?
> switched Upstash to paid tier after finding silent rate limiting in prod

Why?
> free tier drops requests above 100/min silently, no error returned

What was ruled out? (Enter to skip)
> self-hosted Redis — too much infra overhead at current scale

Workflow? [manual/debug/plan/discovery] (Enter for manual)
> discovery

Writing to shadow branch... done.
✓  Decision recorded (dec-3f9a1b2c)
   View: prepcli log
```

**Inline mode** — no prompts:

```bash
prepcli record \
  --what="switched Upstash to paid tier" \
  --why="free tier silently drops requests above 100/min" \
  --ruled-out="self-hosted Redis, Upstash Pro alternative plan" \
  --workflow=discovery
```

Manual records are marked `ai_turn_count: 0` so you can distinguish them from AI session records in `prepcli log`. Records are written directly to the shadow branch — no push needed.

### Accessing records on a fresh clone

```bash
git clone https://github.com/your/repo
git fetch origin prepcli/shadow/v1:prepcli/shadow/v1
prepcli log   # full decision history available immediately
```

No account required. The history is pure git objects.

---

## Installation options

**Temporary (no global install):**
```bash
npx prepcli install
```

**Permanent global install:**
```bash
npm install -g prepcli
prepcli install
```

When prompted, choose where to install:
- **Claude Code** — personal (`~/.claude/commands`) or project (`.claude/commands`)
- **Cursor** — `.cursor/prompts`
- **Windsurf** — `.windsurf`

---

## Auth

Login is via email OTP — no password required:

```bash
prepcli auth login     # sends a one-time code to your email
prepcli auth status    # show current session and expiry
prepcli auth logout    # invalidate session
```

Auth is optional. Without it:
- Workflow commands work fully
- `prepcli init` saves context locally in `.prepclirc`
- Session recording writes to the shadow branch locally
- Cloud sync and `recent_decisions` injection are disabled

---

## Commands reference

```bash
prepcli install                    # copy workflow files to AI tool directories
prepcli uninstall                  # remove workflow files

prepcli auth login                 # sign in with email OTP
prepcli auth logout                # sign out
prepcli auth status                # show current session

prepcli init                       # scan project, push context, set up shadow branch
prepcli context                    # show current project context
prepcli context --preview          # show what STEP 0 injects
prepcli context --edit             # edit and push context

prepcli session add                # add a turn to the local session file (used by AI)
prepcli session show               # inspect the current session
prepcli session clear              # clear the session file

prepcli log                        # browse decision records
prepcli log --workflow <type>      # filter by workflow
prepcli log --file <path>          # filter by file
prepcli log --commit <hash>        # show decision for a specific commit

prepcli record                     # manually save a decision (interactive)
prepcli record --what "..." --why "..." --ruled-out "..." --workflow manual
prepcli stats                      # show prompt quality scores and delta trends
prepcli doctor                     # diagnose setup issues
```

---

## Files created in your project

| File | What it is | Safe to commit |
|---|---|---|
| `.prepclirc` | Project ID + git remote | Yes |
| `.git/hooks/pre-push` | Hook installed by `prepcli init` | N/A (in .git) |
| `.prepcli-session` | Local session accumulator | No (in .gitignore) |

---

## Requirements

- Node.js >= 18
- Git
- Claude Code, Cursor, or Windsurf

---

## Self-hosting

Run your own backend instead of using `api.prepcli.in`:

1. Create a [Supabase](https://supabase.com) project
2. Run `schema.sql` in the Supabase SQL editor
3. Deploy `worker/` to [Cloudflare Workers](https://workers.cloudflare.com)
4. Set Cloudflare secrets:
   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_ANON_KEY
   ```
5. Point the CLI at your worker:
   ```bash
   PREPCLI_API_URL=https://your-worker.workers.dev prepcli init
   ```

---

## Codebase structure

```
bin/
  prepcli.js           CLI entry point

src/
  commands/
    auth.js            login / logout / status
    init.js            project setup
    context.js         read and edit project context
    session.js         local session accumulator
    hook.js            pre-push hook handler
    log.js             browse decision records
    record.js          manual decision entry
    install.js         workflow file installer
    stats.js           quality scores (Phase 4)
    team.js            team management (Phase 6)
    doctor.js          setup diagnostics (Phase 6)

  lib/
    api.js             HTTP client → api.prepcli.in
    config.js          auth token + .prepclirc helpers
    detect.js          stack auto-detection
    git.js             shadow branch plumbing
    session-file.js    .prepcli-session read/write
    decision.js        Markdown record builder
    targets/           AI tool detection (Claude, Cursor, Windsurf)

workflows/
  prep.md              /prep workflow
  debug.md             /debug workflow
  plan.md              /plan workflow
  refactor.md          /refactor workflow
  review.md            /review workflow
  write.md             /write workflow

worker/
  src/index.js         Cloudflare Worker (API layer)

schema.sql             Supabase schema + RLS policies
docs/
  design.md            Visual design reference
```

---

## License

MIT
