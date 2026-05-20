# agents.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Architecture Map

**Start at `Architecture.md`. Update it when reality drifts.**

- Before any task: read `Architecture.md`. If Task Patterns lists a match, follow that number in `EntryPoints.md`.
- Before any UI, CSS, layout, or responsive task: also read `docs/ui-responsive-guidelines.md` and follow it as the operational UX standard.
- Before any local server, Playwright screenshot, or Codex App Browser capture task: read `docs/dev-server-and-capture.md` and follow its verified ProjectAMO procedure.
- After any task: update if files moved, a role memo is stale, a new non-obvious rule appeared, or a task flow changed. Otherwise don't touch.
- Before adding a line, check if a line can be removed. Both files must stay scannable in seconds.

For UI, CSS, layout, and responsive work:
- Treat `docs/ui-responsive-guidelines.md` as the detailed working guide.
- Do not implement major mobile/tablet structure changes by default; capture evidence and write proposals first unless the user explicitly approves implementation.

## 6. Encoding Safety

Do not overwrite UTF-8 files with PowerShell `Set-Content`/`Out-File`/`>`. Use `apply_patch` for edits and Node `fs.writeFileSync(... 'utf8')` for mechanical rewrites. See `docs/policies/encoding-safety.md` for details.

## 7. Code Review Graph

For non-trivial refactors, reviews, dependency changes, or impact analysis, narrow scope with `code-review-graph` before reading broad parts of the codebase. See `docs/policies/code-review-graph.md` for install, CLI commands, and hook behavior.

## 8. Superpowers Subagent Orchestration

For this repository, any user request to execute a Superpowers workflow, follow a Superpowers plan, or work from `docs/superpowers/plans/*` is an explicit user request to use subagents/delegation where the workflow calls for it.

When using Superpowers workflows, the main agent must act as the orchestrator and assign suitable subagents from `.codex/agents/` whenever the task has cleanly separable planning, investigation, implementation, review, QA, security, or architecture work.

- Prefer the workflow-support roles: `task-distributor`, `code-mapper`, `implementer`, `spec-reviewer`, `reviewer`, `test-gap-finder`, `debugger`, `security-auditor`, `ui-qa-reviewer`, `architect-reviewer`, and `design-reviewer`.
- Keep review, mapping, QA, security, and architecture agents read-only. Use `implementer` for file edits.
- Use parallel subagents primarily for read-heavy exploration, tests, triage, log analysis, QA, security review, architecture review, and summarization.
- Keep write-heavy implementation sequential unless file ownership is clearly disjoint and integration ownership is explicit.
- Subagents must still follow this file, `Architecture.md`, and `EntryPoints.md` when present.

## 9. Long Context Tasks

If a task matches **two or more** of the following, follow `docs/policies/long-context-handoff.md`:

- Estimated time 1 hour+
- 10+ files to touch or explore
- 3+ independent work units
- Both backend and frontend
- New API endpoint, DB schema, or directory structure
- Unlikely to finish in one session
- Security, auth, payments, or migrations
- Context utilization already at 40%+

When it applies, read the policy first and follow its procedure. When it does not, ignore this section and proceed with a short prompt.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
