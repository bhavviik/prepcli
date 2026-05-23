# prepcli

Persistent AI collaboration layer — structured prompts, project context, and self-improving sessions for Claude, Cursor, Windsurf, and more.

## What it does

prepcli installs a set of workflow slash commands into your AI coding tool. Instead of starting every AI session cold, you get a structured prompt-building process that asks the right questions before the AI starts working — reducing back-and-forth and producing better output on the first attempt.

## Requirements

- Node.js >= 18
- Claude Code, Cursor, or Windsurf

## Quick start

```bash
npx prepcli install
```

That's it. Open your AI tool and type `/prep`, `/debug`, or any workflow command.

## Workflow commands

| Command | What it does |
|---|---|
| `/prep` | Universal session starter — ask targeted questions, build a structured prompt, execute on approval |
| `/debug` | Turn a vague bug report into a precise debugging prompt |
| `/plan` | Gather product and technical constraints, build a planning prompt |
| `/refactor` | Gather constraints for a safe refactor, build a precise refactoring prompt |
| `/review` | Gather review intent and constraints, build a focused code review prompt |
| `/write` | Gather audience and constraints for writing, build a precise writing prompt |

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

## Account (optional)

Create a free account to enable cloud features:

```bash
prepcli auth login    # sign in with email OTP
prepcli auth status   # check current session
prepcli auth logout   # sign out
```

No password required — login is via a one-time code sent to your email.

## Self-hosting

If you want to run your own backend:

1. Create a [Supabase](https://supabase.com) project
2. Run `schema.sql` in the Supabase SQL editor
3. Deploy `worker/` to [Cloudflare Workers](https://workers.cloudflare.com)
4. Set Cloudflare secrets:
   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_ANON_KEY
   ```
5. Set your Worker URL:
   ```bash
   # In .env
   PREPCLI_API_URL=https://your-worker.your-account.workers.dev
   ```

## Contributing

Pull requests are welcome. The codebase is organized as:

```
bin/          CLI entry point
src/
  commands/   One file per command
  lib/        Shared utilities (api, config)
  lib/targets AI tool detection (Claude, Cursor, Windsurf)
workflows/    Slash command markdown files
worker/       Cloudflare Worker (API layer)
schema.sql    Supabase database schema + RLS policies
```

## License

MIT
