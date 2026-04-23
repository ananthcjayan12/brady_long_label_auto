# Template Usage & Development Cycle

This guide explains how to:

1. Use this repository as a GitHub template.
2. Adapt it for your custom project.
3. Run a consistent development cycle with engineers or AI coding agents.

## 1) Create a project from this template

### Step A — Create from template on GitHub

1. Open the template repository page.
2. Click **Use this template**.
3. Choose owner/org, repository name, and visibility.
4. Create repository.

### Step B — Clone and run locally

```bash
git clone https://github.com/<org>/<new-repo>.git
cd <new-repo>
```

Start backend:

```bash
cd print-server
pip install -r requirements_server.txt
python app.py
```

Start frontend (new terminal):

```bash
cd frontend
npm install
npm run dev
```

### Step C — Validate baseline behavior

- Open UI and confirm server URL is reachable.
- Load/select a printer.
- Enter QR data and print/preview one label.

If this works, your project baseline is healthy.

## 2) Customize this template for your project

Use this checklist in order.

### A. Branding and naming

Update:

- Repository name on GitHub.
- Frontend app title in `frontend/index.html`.
- Package name in `frontend/package.json`.
- Workflow labels/artifact names in `.github/workflows/`.

### B. Ownership and governance

Update:

- Team mappings in `.github/CODEOWNERS`.
- Review process in branch protection settings.
- Task format using `FEATURE_PROMPT_TEMPLATE.md`.

### C. Product behavior customization

Typical changes:

- UI fields in `frontend/src/pages/QRTemplatePage.jsx`.
- API request/response handling in `frontend/src/api.js`.
- Backend QR/print logic in `print-server/app.py` and `print-server/services.py`.

### D. Environment/config defaults

Decide and document:

- Default backend URL.
- Printer selection strategy (default vs explicit).
- Label dimensions and print quality defaults.

### E. Documentation updates

Whenever behavior changes, update:

- `README.md`
- `frontend/README.md`
- `print-server/README_SERVER.md`

## 3) Development cycle (recommended)

This is the standard cycle for every feature.

### Phase 1 — Define feature request

Create an issue using:

- `.github/ISSUE_TEMPLATE/feature_request.yml`

Or paste the format from:

- `FEATURE_PROMPT_TEMPLATE.md`

Feature requests must include:

- Goal
- Scope
- Constraints
- Acceptance criteria
- Out-of-scope

### Phase 2 — Implement (human or AI)

Implementation rules:

- Keep changes minimal and scoped.
- Do not refactor unrelated modules.
- Route frontend API calls through `frontend/src/api.js`.
- Add robust error handling for API and print operations.
- Follow `.github/copilot-instructions.md` and `TEMPLATE_PLAYBOOK.md`.

### Phase 3 — Validate

Run and report:

```bash
cd frontend && npm run build
cd print-server && python3 -m py_compile app.py services.py
```

Also perform manual sanity check for the changed workflow.

### Phase 4 — Review and merge

Open PR using:

- `.github/pull_request_template.md`

PR must include:

- Summary of behavior change
- Validation command output
- Risk/rollback notes
- Doc updates (if applicable)

### Phase 5 — Release

- Merge to main branch.
- Run CI workflows.
- Tag release/version if needed.
- Communicate release notes to users/operators.

## 4) AI-agent operating model (Copilot / Claude)

Use this exact assignment style:

1. Share a filled prompt from `FEATURE_PROMPT_TEMPLATE.md`.
2. State “Implement directly in repo and run validations.”
3. Require changed files list + test/build outputs.
4. Require docs update when behavior changes.

### Good prompt example (short)

> Goal: Add bulk QR input (one line per label) with per-item print status.
> Scope: frontend/src/pages/QRTemplatePage.jsx, frontend/src/api.js, print-server/app.py.
> Constraints: No redesign, keep single-label flow unchanged.
> Acceptance: 1..100 lines supported; failed lines return clear error; build and py_compile pass.
> Out-of-scope: CSV import, auth changes.



## 4) Common pitfalls to avoid

- Ambiguous feature requests without acceptance criteria.
- Allowing broad, multi-area refactors in one feature PR.
- Skipping validation commands before merge.
- Forgetting docs updates after behavior/config changes.
- Hardcoding environment-specific values without documenting them.

## 5) Definition of done (template project)

A feature is done only when:

1. Acceptance criteria are met.
2. Required validations pass.
3. Docs are updated.
4. PR is approved by CODEOWNERS.
5. Manual sanity check passes for the changed flow.
