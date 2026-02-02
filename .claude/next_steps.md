# CLAUDE.md

## Pending Dependency Upgrades

### Frontend (npm) — `frontend/package.json`

| Package | Current | Latest | Type |
|---|---|---|---|
| `react` | 18.2.0 | 19.2.4 | Major — breaking changes |
| `react-dom` | 18.2.0 | 19.2.4 | Major — breaking changes |
| `@types/react` | 18.2.55 | 19.2.10 | Major (follows React) |
| `@types/react-dom` | 18.2.19 | 19.2.3 | Major (follows React) |
| `@vitejs/plugin-react` | 4.2.1 | 5.1.2 | Major |
| `lucide-react` | 0.562.0 | 0.563.0 | Minor |
| `react-window` | 2.2.5 | 2.2.6 | Patch |
| `typescript` | 5.3.3 | 5.9.3 | Minor |
| `vite` | 7.3.0 | 7.3.1 | Patch |

#### React 19 Migration Notes

React 19 includes breaking changes that require careful migration:
- New JSX transform requirements
- Ref handling changes (ref is now a regular prop, no more `forwardRef`)
- Removal of deprecated APIs (`defaultProps` on function components, string refs, etc.)
- `useContext` replaced by `use(Context)`
- New `use()` hook for promises and context

Upgrade React, its types, and `@vitejs/plugin-react` together as a batch.

### Backend (pip) — `backend/requirements.txt`

| Package | Current | Latest | Type |
|---|---|---|---|
| `SQLAlchemy` | 2.0.45 | 2.0.46 | Patch |
| `starlette` | 0.50.0 | 0.52.1 | Minor (FastAPI transitive dep) |
| `python-multipart` | 0.0.21 | 0.0.22 | Patch |
| `anyio` | 4.12.0 | 4.12.1 | Patch |
| `greenlet` | 3.3.0 | 3.3.1 | Patch |
| `pip` | 23.0.1 | 26.0 | Major (tooling only) |
| `setuptools` | 66.1.1 | 80.10.2 | Major (tooling only) |

Backend patches are all safe to apply. Run `pip install --upgrade <package>` inside the venv.

### Recommended Upgrade Order

1. **Safe patches first** — `vite`, `react-window`, `lucide-react`, `typescript`, and all backend patches
2. **React 19 migration** — `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react` (test thoroughly after)
3. **Tooling** — `pip`, `setuptools` (low risk, only affects dev environment)

*Last checked: 2026-02-02*
