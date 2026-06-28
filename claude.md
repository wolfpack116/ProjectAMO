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

## 2. 단순성 · 외과적 변경

과잉설계·범위 외 변경 차단은 **ponytail 플러그인**이 담당한다(결정 사다리 자동 검사). 별도 산문 규칙은 두지 않는다.

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
- Before any UI, CSS, layout, responsive, or design task: also read `docs/design/design-language.md` (the design constitution — single source of truth) and follow it.
- After any task: update if files moved, a role memo is stale, a new non-obvious rule appeared, or a task flow changed. Otherwise don't touch.
- Before adding a line, check if a line can be removed. Both files must stay scannable in seconds.

For UI, CSS, layout, and responsive work:
- Treat `docs/design/design-language.md` as the single source of truth for tokens, color, typography (Pretendard), responsive rules, and workflow.
- Do not implement major mobile/tablet structure changes by default; capture evidence and write proposals first unless the user explicitly approves implementation.

## 6. Encoding Safety

Do not overwrite UTF-8 files with PowerShell `Set-Content`/`Out-File`/`>`. Use `apply_patch` for edits and Node `fs.writeFileSync(... 'utf8')` for mechanical rewrites. See `docs/policies/encoding-safety.md` for details.

## 7. Code Knowledge Graph (graphify)

Query the **graphify** knowledge graph before broad code reading — this is auto-enforced by a PreToolUse hook in `.claude/settings.json` (grep/source-read inject a "use graphify first" reminder) and detailed in the graphify section at the end of this file. Refresh with `graphify update .` (code-only, no API key; auto-runs via the post-commit git hook). Graph results never replace build/runtime/browser verification.

## 8. Browser Verification

For any browser-visible behavior (UI, layout, responsive, rendering), verify with **Playwright** — write/run Playwright scripts (`npx playwright ...`) and capture screenshots/assertions through it.

- Do NOT use the Claude Preview (`preview_*`) MCP tools. They are disallowed for this project; use Playwright instead.
- Before any local server or Playwright screenshot task: read `docs/dev-server-and-capture.md` and follow its verified ProjectAMO procedure.

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

## 10. Session Hygiene

- 같은 문제 2회 연속 실패 시 `/clear` 후 재시작.
- 긴 세션은 `/compact`에 "무엇을 남길지" 지시와 함께 사용.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
