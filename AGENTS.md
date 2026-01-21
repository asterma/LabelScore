# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` contains the React + TypeScript UI built with Vite. Core code lives in `frontend/src/` with `api/`, `components/`, `pages/`, `hooks/`, `types/`, and `utils/`.
- `backend/` contains the FastAPI service. Application code lives in `backend/app/` with `api/routes/`, `services/`, `schemas/`, and `utils/`.
- `backend/tests/` is reserved for pytest suites (currently minimal).
- `data/` stores datasets (`raw/`, `processed/`) used for local evaluation.
- `scripts/` contains helper scripts for maintenance or data prep.

## Build, Test, and Development Commands
Frontend (from `frontend/`):
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server.
- `npm run build` produces a production build.
- `npm run lint` runs ESLint for TS/TSX.
- `npm run type-check` runs `tsc --noEmit`.

Backend (from `backend/`):
- `python -m venv .venv && source .venv/bin/activate` sets up a virtual env.
- `pip install -r requirements.txt` installs runtime deps.
- `uvicorn app.main:app --reload --port 8000` runs the API server.
- Optional dev deps (pytest/ruff) are defined in `pyproject.toml`.

## Coding Style & Naming Conventions
- TypeScript uses 2-space indentation (default Vite/ESLint) and React component files end in `.tsx`.
- Python uses 4-space indentation and Ruff with line length 88 (see `backend/pyproject.toml`).
- Prefer `camelCase` for functions/variables, `PascalCase` for React components, and `snake_case` for Python.

## Testing Guidelines
- Backend tests use `pytest` (configured in `backend/pyproject.toml`) and should live under `backend/tests/` with names like `test_api.py`.
- No frontend test framework is configured yet; add one only if needed and document it here.

## Commit & Pull Request Guidelines
- Git history currently contains only an “Initial commit”, so no formal commit convention exists yet. Use concise, imperative summaries (e.g., “Add batch scoring endpoint”).
- PRs should include: a short description, steps to verify (commands + expected result), and screenshots for UI changes.

## Agent Notes
- Keep changes scoped: update `README.md` and `AGENTS.md` when adding new commands or tooling.
- Avoid committing large files in `data/` unless explicitly required.
