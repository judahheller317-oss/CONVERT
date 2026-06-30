# AE Compatibility Converter — PRD

## Original Problem Statement
Build a full-stack web app "AE Compatibility Converter" that lets users upload Adobe After Effects project files (.aepx XML, also .aep) and downgrade them to older versions (2020/2021/2022/2023) by removing unsupported effects, replacing modern effects with older equivalents, and rewriting version metadata. Outputs a downloadable .aepx or zip with report. Explicitly NOT an official Adobe conversion tool.

## User Choices
- Backend: FastAPI (Python) — same functionality as requested Node/Express.
- No authentication, no history persistence.
- Accept both .aepx and .aep (binary .aep handled in detection-only mode).
- Bonus 0–100 score skipped; detected version + removed/replaced effect lists + warnings included.

## Architecture
- **Backend** (`/app/backend`): FastAPI. `converter.py` = downgrade engine (XML parse via ElementTree, version detection, remove/replace rules, binary .aep ASCII scan). `server.py` = endpoints + temp file handling (auto-delete after 1h).
  - `POST /api/convert` (multipart: file + target_version) → conversion report JSON.
  - `GET /api/download/{job_id}` → converted file. `GET /api/download/{job_id}/zip` → file + report.
  - `GET /api/sample` → sample .aepx. `GET /api/versions` → supported targets.
- **Frontend** (`/app/frontend/src/pages/Converter.jsx`): single-page brutalist/terminal UI. Drag-drop upload, version dropdown, convert, terminal-style results panel, download (.aepx + .zip).
- No database used (no persistence required).

## User Personas
- After Effects editors/freelancers needing to open newer project files on older AE installs.

## Core Requirements (static)
- Parse .aepx XML, apply version-based downgrade rules, keep output valid XML, rewrite version metadata, downloadable output.
- Clear, persistent non-affiliation disclaimer.

## Implemented (2026-06-30)
- Full conversion engine: remove effects newer than target, replace modern→legacy effects, rewrite version metadata, valid XML output.
- Upload (.aepx/.aep), target version select (2020–2023), convert, download single file + zip bundle with report.
- Binary .aep detection-only mode with clear warnings.
- Sample .aepx generator endpoint + UI link.
- Brutalist dark UI with disclaimer marquee, terminal results panel.
- Tested: 10/10 backend pytest, full frontend E2E — all passing.

## Backlog
- P1: Compatibility score (0–100%) gauge.
- P2: Drag-multiple / batch conversion; per-effect toggle (choose what to remove).
- P2: True deep .aep binary rewrite (currently detection-only).
- P2: Conversion history (would require auth + DB).

## Next Tasks
- Gather user feedback on real .aepx files; expand effect/version rules as needed.
