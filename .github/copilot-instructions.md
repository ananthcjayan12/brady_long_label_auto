# Copilot Instructions for This Template

You are implementing features in a QR label generation + print template.

## Non-negotiable rules

- Make code changes directly; do not stop at analysis.
- Keep changes scoped to the requested feature.
- Do not introduce unrelated refactors.
- Preserve existing endpoint behavior unless explicitly requested.
- Add robust error handling for API and print operations.
- Update docs when behavior, setup, or configuration changes.

## Repository conventions

- Frontend calls must go through `frontend/src/api.js`.
- Keep UI simple and operational; avoid decorative complexity.
- Backend QR/print behavior is in `print-server/app.py` and `print-server/services.py`.

## Validation checklist

Run and report:

- Frontend: `cd frontend && npm run build`
- Backend: `cd print-server && python3 -m py_compile app.py services.py`

## Done criteria

A feature is complete only when:

1. Behavior matches requested acceptance criteria.
2. Relevant validation commands pass.
3. Documentation is updated where needed.
