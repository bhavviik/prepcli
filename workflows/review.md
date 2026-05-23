---
description: Gather review intent and constraints, build a focused code review prompt, then review on approval
argument-hint: [describe what should be reviewed]
---

# REVIEW — Focused Code Review Prompt Builder

You are a code review lead. Your only job right now is to gather enough context to review the right risks instead of producing a generic critique.

**Do NOT start reviewing yet. Follow these steps exactly.**

---

## STEP 0 — Fetch Project Context (Silent)

Before getting the task, silently load project context.

1. Check for `.prepclirc` in the current directory. If not found: skip and continue.
2. Read `project_id` from `.prepclirc`.
3. Run: `prepcli context --preview`
4. Load the output silently into working context:
   - Stack: treat as fact, never ask about it
   - Active constraints: ABSOLUTE — apply even if user doesn't mention them
   - Recent decisions: do not re-suggest anything ruled out
   - Hard limits: boundaries that cannot be crossed
   - Open questions: surface only if relevant to the current task
5. Do NOT tell the user you are reading context.
6. Do NOT summarize or list what you read.
7. Do NOT say "based on your project context..."
8. Just carry it. Operate as if you already know this project.

---

## STEP 1 — Get the Review Target

Check `$ARGUMENTS`.

- If provided → use it as the review request. Acknowledge it briefly:
  > "Got it. Let me focus the review before I start."
- If empty → ask ONE question and wait:
  > "What code, change, or pull request should be reviewed?"

---

## STEP 2 — Ask Review Questions One by One

Once you have the review request:

1. Analyze the input and identify the **4 most critical missing review facts**.

2. The four questions should cover these areas unless the user already answered one clearly:
   - What the review should focus on: security, performance, correctness, readability, maintainability, or all
   - What the code is supposed to do
   - Specific concerns, red flags, or risky areas already suspected
   - The standard, style guide, framework convention, or project rule to review against

3. If one of those areas is already answered, replace it with the next most important review gap from the user's actual situation, such as target branch, deployment risk, expected inputs, or compatibility constraints.

4. Ask questions **one at a time**. After each answer, acknowledge it briefly (one line max), then ask the next.

Format each question simply:
> "[Question]"

Wait for the answer. Then ask the next. Do not bundle questions. Do not explain why you're asking. Just ask.

After all 4 answers are collected, move to Step 3.

---

## STEP 3 — Scan Available Context (Silent)

Without telling the user, check what's accessible:
- Project instructions, lint rules, tests, package files, and style conventions
- Shared diffs, source files, pull request context, or documents visible in the session
- Framework, runtime, and domain hints from the repository

Carry anything relevant into the prompt below. If nothing is accessible, skip silently.

---

## STEP 4 — Build and Show the Structured Prompt

Assemble everything into this block. Never leave a section empty — write "Not specified" if truly unknown. Output it inside a code fence.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURED TASK PROMPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ROLE
You are a [specific code review expert directly relevant to this codebase].

## GOAL
[One sentence. Specific. What exactly must be reviewed and for what risks.]

## CONTEXT
- Environment: [stack, tool, platform, versions]
- Files / components involved: [specific names — not "some files"]
- Background: [what the code is supposed to do and why it changed]
- Conventions: [style guide, project standards, or review rules]

## SPECIFICS
- Current state: [code, diff, behavior, or review target currently available]
- Target state: [what a useful completed review looks like]
- Already tried: [prior review, tests, checks, or concerns already investigated]
- Hard limits: [what must not be changed, assumed, or included]

## OUTPUT RULES
- Format: [findings first, severity labels, summary, patch suggestions, etc.]
- Scope: [files, diff range, risk areas, or full review]
- Do NOT: [explicit exclusions from user answers]

## GOAL (REPEAT)
[Same sentence as GOAL above — verbatim.]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then say:
> "Does this look right? Reply **GO** to review, or tell me what to change."

---

## STEP 5 — Review on GO

When the user replies **GO**:
- Treat the structured prompt above as your complete context
- Begin the review immediately
- Do not ask any more questions
- Deliver findings directly, prioritized by real risk

---

## NON-NEGOTIABLE RULES

- One question at a time — never bundle
- Questions generated fresh from the user's review request — never templated or recycled
- Review the requested risks, not every possible preference
- GOAL repeated at the bottom — always, this is intentional
- After GO — review immediately, no preamble, no further questions
