# Template Playbook (QR Scan Label - Dual Template)

This document defines the exact implementation rules for the new QR-scan label requirement.

## 1) Goal

Generate and print labels by scanning QR content where:

1. QR input is split into `Line 1` and `Line 2`.
2. User can choose one of two template options.
3. Layout follows the measured label zones in `media/measurement.jpeg`.
4. Grey zone in measurement is treated as no-print (white/transparent sticker area).

## 2) Input Data Rules (from scanned QR)

Expected QR payload format:

- `<line1>$<line2>`

Examples from provided sheet:

- `FOB1NA2R411105MA$2534007223`
- `FOB1NA2R41165MA$2531000084`

Parsing rules:

1. Split by `$` into exactly 2 parts.
2. `Line 1` = left part (alphanumeric, typically 15 or 16 chars).
3. `Line 2` = right part (numeric, 10 digits).
4. If parsing fails, show clear validation error and block print.

## 3) Template Options

The UI must provide a template selector with exactly two options:

1. `Template 1` (first cell type).
2. `Template 2` (second cell type).

Behavior:

1. If user selects `Template 1`, render using first-cell-type label format.
2. If user selects `Template 2`, render using second-cell-type label format.
3. Both templates must print `Line 1` and `Line 2`.
4. The logo must be included according to selected template type.
5. Base logo asset path: `media/logo.jpeg`.

## 4) Label Geometry and Print Area

Use `media/measurement.jpeg` as source of truth:

- `A = 1.0 in` (label content width).
- `B = 0.5 in` (top printable content block height).
- `C = 1.5 in` (total label height).

Layout requirements:

1. Printable content (logo + text + barcode as needed) must stay in the top region.
2. The lower region (shown as grey in measurement image) must be left blank.
3. Blank region must output as white/no-ink so transparent sticker behavior is preserved.

## 5) Content Mapping on Label

For each scanned QR:

1. `Line 1` text is printed on first text line.
2. `Line 2` text is printed on second text line.
3. Barcode content should be generated from `Line 2` (as indicated in the provided table: "Bar code for 2nd line").

## 6) Implementation Boundaries

Frontend:

1. Add template option selector in `frontend/src/pages/QRTemplatePage.jsx`.
2. Parse QR input into `line1` + `line2` with validation.
3. Send selected template type and parsed fields in print/preview payload.
4. Show preview matching the selected template.

Backend:

1. Extend print/preview logic in `print-server/app.py` and `print-server/services.py`.
2. Render two label template variants.
3. Enforce A/B/C layout and bottom blank region.
4. Place logo from configured asset (`media/logo.jpeg`).

## 7) Acceptance Criteria (must pass)

1. Scanned string with `$` splits into two lines correctly.
2. Invalid scan input returns explicit, user-friendly error.
3. User can switch between `Template 1` and `Template 2`.
4. Preview updates correctly for selected template.
5. Printed output contains logo, line 1, line 2, and barcode from line 2.
6. Bottom area remains blank/white (no printed content).
7. Frontend build passes: `cd frontend && npm run build`.
8. Backend syntax check passes: `cd print-server && python3 -m py_compile app.py services.py`.

## 8) Out of Scope

1. Any redesign unrelated to this label workflow.
2. Changes to authentication, user management, or deployment pipelines.
3. New input file upload formats beyond scanned QR data for this task.
