# QR Label Print Template

Template repository for building QR label generation + local print workflows.

This base is designed to be used with human engineers or AI coding agents (GitHub Copilot, Claude Code, etc.) by giving them scoped feature instructions.

## What this template already provides

- React frontend UI for QR content input, local preview, and print trigger.
- Flask print bridge API with QR PDF generation and printer dispatch.
- Cross-platform printer discovery endpoint.
- CI workflow scaffolding for frontend deploy and Windows print-server packaging.

## Repository structure

- `frontend/` — UI application.
- `print-server/` — local print bridge.
- `.github/workflows/` — CI/CD workflows.
- `TEMPLATE_PLAYBOOK.md` — implementation process and quality gate for all future features.
- `TEMPLATE_USAGE_AND_DEV_CYCLE.md` — how to use this template, customize a project, and run the delivery cycle.
- `.github/copilot-instructions.md` — coding rules for AI agents.

## Quick start

### 1) Start backend

```bash
cd print-server
pip install -r requirements_server.txt
python app.py
```

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
```

### 3) Run the template flow

1. Open frontend in browser.
2. Set server URL (`http://localhost:5001` by default).
3. Load/select printer.
4. Enter QR data and optional label text.
5. Click **Generate & Print QR**.

## How to request new features (for engineers or AI)

Use this format when assigning work:

1. **Goal**: one sentence user outcome.
2. **Scope**: files/folders allowed to change.
3. **Constraints**: UX/design/performance/security rules.
4. **Acceptance criteria**: concrete checks and edge cases.
5. **Out-of-scope**: what must not change.

Then require implementation to follow `TEMPLATE_PLAYBOOK.md`.

Use `FEATURE_PROMPT_TEMPLATE.md` as the default request format in issues/PR descriptions.

## Rename for your org/product

Update these items after creating your own repo from this template:

- Repository name on GitHub (recommended: `qr-label-print-template` or your product-specific name).
- `frontend/index.html` `<title>`.
- `frontend/package.json` `name`.
- `.github/workflows/*.yml` project/artifact names.

## Publish this as a GitHub Template

1. Create a new GitHub repo and push this code.
2. Open **Settings → General → Template repository**.
3. Check **Template repository**.
4. Add branch protection + CODEOWNERS (recommended).
5. Tell engineers to click **Use this template** when starting feature repos.

## Platform note

- On macOS, server currently runs preview-mode behavior rather than physical print.
- Windows/Linux perform physical printer dispatch via local print commands.
