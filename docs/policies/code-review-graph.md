# Code Review Graph

For non-trivial refactors, reviews, dependency changes, or impact analysis, use `code-review-graph` to narrow scope before reading broad parts of the codebase.

## Operating Rules

- For non-trivial refactors, reviews, dependency changes, or impact analysis, consult `code-review-graph` before broad code reading.
- Use graph impact queries to discover related files, then inspect only those source files.
- Do not treat graph results as a replacement for build, runtime, or browser verification.

## Codex Hook Behavior

- `.codex/hooks.json` checks graph status on session start and refreshes the graph after edits or shell activity when `code-review-graph` is installed.
- The same hook auto-allows the safe direct shell commands (`code-review-graph status`, `update`, `update --skip-flows`, `detect-changes`) so subagents can use graph context without repeated approval prompts.

## New Machine Setup

```bash
python -m pip install code-review-graph
code-review-graph build
code-review-graph status
```

## CLI Fallback (when MCP tools are unavailable)

```bash
code-review-graph update
code-review-graph detect-changes
code-review-graph status
```
