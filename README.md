# bazzza

Offline desktop scaffold on Electron + Vite + React + TypeScript.

Storage engine: SQLite via **sql.js (WASM)** (no native module compilation required).

## Screens (stubs)
- Imports
- Mappings
- Cohorts
- Patient
- Conflicts
- Settings
- Analytics

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Dist (win-unpacked folder with `.exe`, no installer): `npm run dist:win-unpacked`
- Migration unit-test: `npm run test:migrations`

## Contracts
- Specification: `docs/SPEC.md`
- Public interfaces: `src/contracts/*.ts`


## Database file management (regional DB switch)
- Open **Settings → База данных**.
- **Открыть базу…** lets you select any existing `.db` file (for example regional databases).
- **Создать новую…** creates a new `.db` and switches the app to it.
- **Экспорт копии…** writes a copy of the current database to a user-selected path.
- **Сделать резервную копию** writes a timestamped backup to `<userData>/backups`.
- After switching DB (open/create/reset), the app relaunches and runs migrations on the selected DB automatically.


## Analytics (MVP)
- Open **Аналитика** from top navigation.
- Shows KPI cards: imports, RAW rows, CANON resolved rows, patients (or `n/a`), unresolved conflicts.
- Includes breakdown table by `cohort_kind × region` and top-10 CANON fields by missingness in resolved view.
- `Экспорт отчёта (CSV)` writes analytics aggregates (overview + breakdown + missingness) to a CSV file via native save dialog.


## Local setup / build (clean environment)
1. Install deps: `npm install`
2. Typecheck: `npm run typecheck`
3. Lint: `npm run lint`
4. Production build: `npm run build`
5. Windows unpacked distribution: `npm run dist:win-unpacked`

## What to verify after launch
1. **Settings → База данных**: check current DB path/info, create backup.
2. **Imports → Mappings → Cohorts**: import data, apply mappings, verify cohort list.
3. **Аналитика**: KPI cards, breakdown table, missingness top-10, CSV report export.


## Why sql.js
- Uses pure JS/WASM SQLite runtime, so `npm install` does not need native compilation toolchain.
- Avoids `node-gyp`/`distutils` issues common with native SQLite drivers on fresh Windows setups (Node v24 + Python 3.12).
