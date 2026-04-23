# Template Playbook

This document defines how every new feature must be implemented in this template repository.

## 1) Delivery Standard

For every feature request:

1. Read the request and restate assumptions.
2. Identify impacted frontend + backend modules.
3. Implement minimum viable changes first.
4. Validate locally (targeted checks, then broader checks).
5. Update documentation if any behavior/config changed.

## 2) Architecture Rules

- Frontend responsibilities:
  - collect user input
  - call API client (`frontend/src/api.js`)
  - display status/preview
- Backend responsibilities:
  - generate printable QR label PDFs
  - discover printers
  - dispatch print jobs
- Keep business logic out of UI components when reusable helper/module can hold it.

## 3) Scope Control

- Do not add unrelated pages or redesigns for small features.
- Keep existing API contracts stable unless the request explicitly changes them.
- Prefer incremental extension over rewrites.

## 4) Quality Gates

Before marking feature complete:

- Frontend builds successfully (`npm run build`).
- Backend syntax is valid (`python3 -m py_compile app.py services.py`).
- New/updated endpoint has error handling + clear response shape.
- User-visible text is explicit and actionable.

## 5) Documentation Rules

Any change that affects usage must update one or more of:

- `README.md`
- `frontend/README.md`
- `print-server/README_SERVER.md`

## 6) Feature Request Template

Use this exact checklist in every issue/task:

- Goal
- Why now
- Scope (files/folders allowed)
- Constraints (UX, security, performance)
- Acceptance criteria
- Out-of-scope

## 7) AI-Agent Prompting Baseline

When assigning work to Copilot/Claude/etc, include:

- “Implement directly in repo, do not just propose.”
- “Run targeted validation commands and report outputs.”
- “Keep changes minimal and scoped to requirement.”
- “Update docs for any behavior/config change.”
