# PROJECT-AUDIT-REPORT — Air Production DB (Project Manager Web Application)

- Audit date: 7 October 2026
- Auditor role: Senior Full-Stack / Architect / Security / QA / DevOps
- Repository: `Project-Manager-AirProduction` (branch `main`, 80 tracked files, last commit `ad4c476`)
- Method: full repository inspection + executed `typecheck`, `lint`, `build`, `dev` runtime probes, dependency tree analysis, git history secret scan. No production code was modified during this audit.

---

## 1. Executive Summary

Air Production DB is a **Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4** internal operations/production-management application. It is **not a classic CRUD+SaaS app**: there is no SQL database, no ORM, no REST/GraphQL API layer, and no authentication. Data lives in a **Google Sheets workbook** (11 worksheets) accessed server-side through a `googleapis` service-account client behind a clean repository abstraction.

**What is genuinely good**

- Clear, respected layering: `UI (app/components) → Server Actions → Services → Repositories → Google Sheets`, with a single switch point (`src/repositories/index.ts:15`).
- TypeScript `strict` with **zero `any`**, zero `console.log`, zero TODO/FIXME, zero dead commented-out code (verified by grep).
- Validation exists in **two layers** (server action parse/enum checks + service business checks) and business rules (Job must have Client XOR Vendor, 3 job statuses, payment termins) are encoded in types and enforced in services.
- `typecheck` **PASS**, `lint` **PASS** (lint script verified to actually lint — a probe file was correctly flagged and removed).
- Secrets hygiene is good: `.env*` ignored, no credentials in git history (scan of all commits for `BEGIN PRIVATE KEY` / `AIza…` returned only documentation text), `admins.password_hash` deliberately never mapped into the domain.

**What blocks production**

1. **There is no authentication and no authorization at all.** Every page and all **30 server actions** (create/update/delete of jobs, clients, vendors, venues, crew, payments, expenses, deliveries) are callable by anyone who can reach the server.
2. **The application does not run in this environment.** `npm run build` fails during prerender and **every route returns HTTP 500** (including the 404 route) because Google Sheets environment variables are absent and the root layout performs a remote Sheets read during render with no fallback and no error boundary.
3. **Zero automated tests** and no test framework, despite business rules that prior phases validated only with throw-away scripts kept outside the repository.

**Overall status: NOT production ready.**

---

## 2. Technology Stack

| Area | Finding |
| --- | --- |
| Framework | Next.js **16.3.8** (App Router, Turbopack build) |
| Language | TypeScript **5.9.3**, `strict: true`, `noEmit` |
| Runtime | Node **v24.21.0** (environment), npm **10.9.9**. No `engines` field; docs claim Node 22 |
| Package manager | **npm** (`package-lock.json` present and consistent) |
| UI library | React **19.2.8** / react-dom 19.2.8 |
| Styling | Tailwind CSS **v4** via `@tailwindcss/postcss`, design tokens in `src/app/globals.css` |
| UI components | Hand-written design system (`src/components/ui/*`), no shadcn/Radix/lucide |
| Icons | Internal SVG components (`src/components/icons.tsx`) |
| State management | None (React state + `router.refresh()`; no Redux/Zustand/SWR/React Query) |
| Validation | Hand-written parsers in server actions + service assertions (no zod/yup) |
| Data store | **Google Sheets** (11 worksheets) via `googleapis` service account |
| ORM/query builder | None — repository pattern implemented manually |
| API architecture | **Server Actions only** (`"use server"`, 30 actions). No `app/api` routes, no REST/GraphQL |
| Auth / AuthZ | **None** (no login, session, cookie, middleware, roles) |
| Testing | **None** (no framework, no test files, no test script) |
| Linting / formatting | ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript). **No Prettier** |
| Build | `next build` (Turbopack) |
| Deployment | No Dockerfile, no CI/CD (`.github` absent), no process manager, no reverse proxy, no health check |
| Environment | `.env.example` (Google vars template, committed), `.env` (untracked, see §5) |
| Documentation | `README.md` + `docs/FREEBUFF_AUDIT.md` (2 440 lines of phase audit logs) |

### Source structure

```
src/
├── app/            # 8 pages + root layout/loading/not-found, 4 server-action modules
├── components/     # layout(3) ui(13) dashboard(1) jobs(3) master(1) finance(1) icons
├── data/mock/      # 9 mock-data modules (fallback/testing)
├── lib/            # types, labels, utils, navigation, google-sheets/client
├── repositories/   # contract + mock + google implementations + mapping
└── services/       # job / master / dashboard / shared / types
```

Total: **7 310 lines** of TS/TSX across 60 files. Largest files: `job-detail-tabs.tsx` (695), `google/mapping.ts` (452), `google/index.ts` (404), `job-service.ts` (362), `jobs-table.tsx` (354).

---

## 3. Current Architecture

```
Server Components (src/app/**)  +  Client Components (src/components/**)
                │                        │
                │                        └──► Server Actions (src/app/actions/*)
                ▼                                    │
        Services (src/services/*)  ◄─────────────────┘
                │  business rules + view-model shaping
                ▼
        getRepositories()  (src/repositories/index.ts)   ← single switch point
                │
     ┌──────────┴──────────┐
     ▼                     ▼
googleRepositories     mockRepositories (in-memory, exported for testing)
     ▼
src/lib/google-sheets/client.ts → Google Sheets API v4 (service account JWT)
```

**Evaluation: NEEDS IMPROVEMENT (layering itself is GOOD).**

- GOOD: separation of UI/business/persistence is real and enforced by import direction; UI never touches `googleapis`; repository contract (`DataRepositories`) lets mock and Google implementations swap cleanly; strict typing end-to-end.
- NEEDS IMPROVEMENT because:
  - there is **no auth/authz layer** and no middleware, although mutations are exposed;
  - there is **no error-handling layer** (no `error.tsx`, `global-error.tsx`, or config pre-flight) while the root layout performs remote IO;
  - **UI duplication**: the modal+busy+error CRUD state machine exists 3× (`master-crud.tsx`, `finance-crud.tsx`, `jobs-table.tsx`) and the full Job form exists 2× (`jobs-table.tsx`, `edit-job-button.tsx`, ~120 duplicated lines);
  - rendering strategy is implicit (static prerender of pages backed by live external data);
  - per-request data access has no memoization/batching layer (duplicate full-sheet reads).
- No circular dependencies found; no business logic inside UI beyond presentation formatting; no database logic inside UI. Dead code is limited (see §17).

---

## 4. Dependency Audit

### 4.1 Production dependencies (4)

| Package | Version | Used by | Verdict |
| --- | --- | --- | --- |
| `next` | 16.3.8 | framework, all routes/actions | **Required**, current |
| `react` / `react-dom` | 19.2.8 | all components | **Required**, current |
| `googleapis` | 183.0.0 | `src/lib/google-sheets/client.ts` only (`google`, `sheets_v4`) | **Required**, used; heavy (239 MB of an 845 MB `node_modules`) — see optional optimization |

No unused production dependency. No duplicate/conflicting version. Not outdated enough to require action.

### 4.2 Development dependencies (8)

| Package | Version | Verdict |
| --- | --- | --- |
| `typescript` | 5.9.3 | Required — works. (Latest is 7.x; do **not** blind-upgrade) |
| `@types/node` | 20.x | Required, but **lags the runtime** (Node 24) — LOW |
| `@types/react`, `@types/react-dom` | 19.3.0 | Required, matched |
| `eslint` | 9.39.5 | Required, flat config works (verified with a probe file) |
| `eslint-config-next` | 16.3.8 | Required, matched to Next version |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | Required, in use in `globals.css` + `postcss.config.mjs` |

`npm audit`: **5 high** — all in the dev-only chain
`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` (DoS advisory). Runtime dependency tree is clean. `npm audit fix --force` would downgrade `eslint-config-next` to 14.2.35 (breaking) → **correctly not applied**.

Node_modules drift: `npm ls --depth=0` reports **6 extraneous packages** (`@emnapi/*`, `@img/sharp-wasm32`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`) — install leftovers not in the lockfile. `npm ci` resolves this; no `package.json` change needed.

### 4.3 Missing dependencies

Every bare import in `src/` resolves to `googleapis`, `next/*`, or `react` (verified by extracting all `from "…"` specifiers). **No package is imported-but-absent.** Missing functionality (tests, auth, structured logging, rate limiting, schema validation) corresponds to **features that do not exist in the code yet**, not to gaps in the current implementation.

---

## 5. Package Lists

### `REQUIRED_PACKAGES` — **0 packages**

Nothing may be installed right now. Evidence:

- `npm run typecheck` → exit 0.
- `npm run lint` → exit 0 (and a deliberately added probe file with `any`/unused var was reported → the script genuinely lints).
- `npm run build` → fails, but **not because of a missing package**: the stack trace is
  `readRequiredEnv (src/lib/google-sheets/client.ts:26)` → `GOOGLE_SHEETS_ID belum diisi`
  (see §18). Installing packages cannot fix a missing credential.
- There are no tests to run, therefore no test runner is required *by the existing code*.

```text
Package: (none)
Reason: all imports resolve; typecheck + lint pass; the build/runtime failure is
        missing Google Sheets credentials + missing error handling, not missing code
Used by: n/a
Current alternative: n/a
Risk if missing: n/a
```

### `OPTIONAL_PACKAGES` — **9 packages** (install only when the matching feature is approved)

| # | Package | Reason | Used by | Current alternative | Risk if missing |
| --- | --- | --- | --- | --- | --- |
| 1 | `vitest` | Test runner for unit/integration tests (audit Phase 12) | new `tests/**` | none (prior phases used throw-away scripts outside the repo) | business rules regress silently |
| 2 | `jsdom` | DOM environment for component tests | component tests | none | UI regressions undetected |
| 3 | `@testing-library/react` | Component/interaction testing | component tests | none | UI regressions undetected |
| 4 | `zod` | Single source of truth for input schemas (server action + form), replaces duplicated hand parsers | `src/app/actions/*` | hand-written `parseValues`/`parseAmount` per action (works, but duplicated and easy to drift) | validation drift between layers |
| 5 | `jose` | Signed session cookies / JWT for the login feature | auth layer (not yet designed) | none | cannot implement auth securely without it (or an equivalent) |
| 6 | `argon2` (alt. `bcryptjs`) | Password hashing for the existing `admins.password_hash` column | auth layer | none (column exists but is never read) | weak/none credential storage |
| 7 | `@upstash/rate-limit` (or a 30-line in-house limiter) | Rate-limit mutating server actions | server actions | none | quota abuse of Sheets API; brute force once login exists |
| 8 | `pino` | Structured server logging/observability | server layer | none (`console` never used) | no operational visibility |
| 9 | `prettier` + `eslint-config-prettier` | Deterministic formatting in CI | tooling | manual consistency | style drift as contributors grow |

Deliberately **not** installed now: installing a test runner with zero tests, or auth libraries with no auth design, would add unused dependencies (rule 3/9).

### `UNNECESSARY_PACKAGES` — **0**

No dependency in `package.json` is unused, duplicated, incompatible, or dangerous. Nothing removed.

---

## 6. Installed Dependencies

**None installed during this audit.** `package.json` and `package-lock.json` are unchanged (verified with `git status` — working tree clean).

---

## 7. Removed Dependencies

**None.**

---

## 8. Database Audit (Google Sheets as the data store)

Schema = 11 worksheets, headers validated on every read by `validateHeaders` (`src/repositories/google/mapping.ts:83`):

`clients, vendors, venues, crew, jobs, job_crews, deliveries, client_payments, vendor_payments, expenses, admins`

| Check | Result |
| --- | --- |
| Foreign keys | **None** (Sheets cannot enforce). Service checks references on *create/update* (`assertRelationsExist`, `job-service.ts:146`) but **not on delete** → **confirmed gap** |
| Cascade deletes | **None.** `deleteJob` (`job-service.ts:192`) removes only the job row → orphan `job_crews`, `deliveries`, `client_payments`, `vendor_payments`, `expenses` rows remain and surface as `"-"`/`Job tidak dikenal` in Finance/Dashboard |
| Referential delete check | **Missing.** `deleteClient/Vendor/Venue/Crew` (`master-service.ts:104-178`) never check whether the record is still referenced → dangling `client_id` etc. → UI shows "Client tidak dikenal" |
| Unique constraints | `job_number` uniqueness is app-checked (`job-service.ts:159`, `google/index.ts:294`) but is a **read-then-write check → TOCTOU race**. Entity `id` uniqueness is only enforced by random generation, never verified on read |
| Indexes | N/A (full worksheet scan per read) |
| Nullability | Enforced only by mapper (`requiredString`/`requiredNumber` throw explicit `SheetMappingError`) |
| Timestamps | `created_at`/`updated_at` maintained for writes; preserved from the sheet on update (`google/index.ts:229`) — correct. Not mapped into domain except for `Job` (documented decision) |
| Data types | Numbers parsed with thousand-separator handling; enums normalized + validated; invalid values throw with worksheet/row/column context (`mapping.ts:108-187`) — good |
| Transactions | **None.** Multi-step writes (validate → append/update) are not atomic |
| Concurrency | **Confirmed risk.** `updateRow`/`deleteRow` use a **row number captured earlier** (`google/index.ts:139-191`); a concurrent insert/delete shifts rows → wrong row updated/deleted. No locking, no append-only log |
| Duplicate records | Not detected on read (only `job_number` is checked at write time) |
| Latent bug | `lastCol = String.fromCharCode(64 + row.length)` (`google/index.ts:142`) breaks for >26 columns (currently max 13) |
| N+1 / repeated reads | `getById` reads the **entire worksheet** then filters (`google/index.ts:260`); `assertRelationsExist` calls it per relation; services re-read the same sheet multiple times per request (see §14) |
| Multi-user isolation | **Not applicable/absent.** Single-tenant, no user concept → every visitor sees everything (this is the security issue in §10, not a query-scoping bug) |
| Data safety | Prior phases left real user rows in the workbook ("rosdiana", "Basir", "masjid hijau"). Any schema change must be non-destructive (rule 13 respected: **no schema change performed**) |

**Rating: NEEDS IMPROVEMENT** — correctness of the mapping layer is high; integrity (cascades, references, atomicity) is the weak point.

---

## 9. Authentication Audit

| Item | Status |
| --- | --- |
| Login / logout | **Absent** — no route, action, form, or session code anywhere in `src/` |
| Session management | **Absent** — no cookies, no `cookies()`, no middleware |
| JWT / token | Only Google service-account JWT (`google-sheets/client.ts:70`) — that is *service-to-Google*, not user auth |
| Password hashing | **Absent.** The sheet has a `password_hash` column (`mapping.ts:68`) but `mapAdmin` intentionally drops it; nothing ever reads or verifies it |
| Password reset / email verification | **Absent** (and there is no mailer) |
| Account status / roles | **Absent.** `getCurrentAdmin()` returns `admins[0] ?? null` (`master-service.ts:36`) purely to display a name in the topbar |
| Multi-factor / lockout / rate limit | **Absent** |

**Verdict: CRITICAL — there is no authentication.** The application is an open write interface to the company's operational and financial spreadsheet.

---

## 10. Authorization Audit

- **No server-side authorization exists.** There is no middleware (`src/middleware.ts` does not exist), no session to authorize, no role model, no per-resource ownership.
- Frontend "protection" is non-existent too — every CRUD control is always rendered.
- **IDOR/BOLA assessment:** the classic `/api/projects/<id>` pattern does not apply (no REST routes), but the equivalent exposure is total: any client can invoke `deleteJobAction(id)`, `updateClientPaymentAction(id, …)`, etc. with any ID (Server Action IDs are embedded in the served JS bundle), and the action will execute. There is no check to perform.
- Next.js's built-in Server-Action **Origin check** provides partial CSRF protection against cross-site invocation, but it does **not** provide authentication.
- Positive note: input is mapped field-by-field in actions (no mass assignment of arbitrary keys into entities).

**Verdict: CRITICAL** (no authentication) / **HIGH** (no authorization model to build on).

---

## 11. API Audit — Server Action Inventory

There are **no HTTP route handlers** (`src/app/api` absent). The API surface is 30 Server Actions in 4 modules + 8 data-reading Server Components.

Common characteristics for **all 30 actions**:

```text
METHOD            Server Action (Next.js POST to current origin)
AUTH REQUIRED     NO            ROLE/PERMISSION      NONE
CSRF              partial (framework Origin check)
OUTPUT           { ok: true } | { ok: false; error: string }   ← consistent
ERROR HANDLING    try/catch → error.message returned verbatim to the client
RATE LIMITING     NONE
SECURITY STATUS   UNAUTHENTICATED MUTATION  →  CRITICAL
```

| File | Actions | Input validation (server-side) | Notes |
| --- | --- | --- | --- |
| `src/app/actions/master-actions.ts` (12) | create/update/delete × Client, Vendor, Venue, Crew | Service-level: non-empty name/role, `defaultPayment` finite ≥ 0; `parseNumber` strips `.`/`,` | No length limits; `revalidatePath` per entity page |
| `src/app/actions/job-actions.ts` (3) | `createJobAction`, `updateJobAction`, `deleteJobAction` | Enum allow-lists for category/status, Client XOR Vendor, relation existence, `job_number` uniqueness | `executionDate` only checked for non-emptiness (no format/length); `run()` revalidates `/jobs` + `/dashboard` **but not `/jobs/[jobNumber]`** |
| `src/app/actions/job-detail-actions.ts` (6) | job crew ×3, delivery ×3 | payment finite ≥ 0, payment/status enums, delivery name/deadline required, quantity ≥ 0 | Revalidates job detail path correctly |
| `src/app/actions/finance-actions.ts` (9) | client payment ×3, vendor payment ×3, expense ×3 | term/type/status enums, amount finite ≥ 0, `jobId` required + existence-checked in service, expense category allow-list | Strongest validation of the four |

Read endpoints (Server Components) call services directly: `/dashboard`, `/jobs`, `/jobs/[jobNumber]`, `/clients`, `/vendors`, `/crew`, `/venues`, `/finance`.

Other API findings:

- **HTTP status codes**: N/A for actions (all return 200 with `{ok:false}`); but pages return **500 for a missing 404 route** when the layout throws (observed).
- **Response format**: consistent action result type — good.
- **Leaked internals**: `error.message` is passed through unchanged (see §12/§16).
- **Excessive data**: Finance page ships both raw and formatted values for every row; no pagination anywhere.
- **Idempotency/duplicate submits**: mitigated client-side by the `busy` flag (buttons disabled) — but the Modal can still be dismissed via Esc/backdrop during flight (`modal.tsx`), which does not re-trigger the action.
- **Injection**: values are written via Sheets `values.append/update` with `valueInputOption: "RAW"` → no formula injection is auto-evaluated by the API (RAW does not parse `=` as a formula), and there is no SQL layer. Risk is low but **formula injection via user-entered `=`/`+` strings should be explicitly neutralised** if anyone ever opens the sheet in Google Sheets with `AUTO` input (currently RAW — acceptable, flagged as a watch item).

---

## 12. Security Audit

| Threat | Status | Evidence |
| --- | --- | --- |
| SQL injection | N/A | No SQL/ORM |
| XSS | **Low risk** | React escaping; no `dangerouslySetInnerHTML`, no `eval`, no `innerHTML` in `src/` (grep: 0) |
| CSRF | **Partially mitigated** | Next Server-Action Origin check; no cookies/sessions yet, so no state to forge *yet* — re-evaluate when auth is added |
| SSRF | N/A | Only fixed Google API endpoints; no user-controlled URLs |
| Command/path traversal/upload/redirect | N/A | No file upload, no shell, no redirects with user input |
| Auth bypass | **Total (no auth)** | §9 |
| Authz bypass / IDOR | **Total (no authz)** | §10 |
| Sensitive data exposure | **Medium** | Raw `error.message` returned to browsers; repository errors include worksheet names, row numbers and upstream Google error text (which may carry the spreadsheet ID) |
| Insecure cookies | N/A | No cookies |
| Security headers | **Missing** | `next.config.ts` is empty; no middleware → no CSP, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, HSTS |
| Secrets in git | **Clean** | `.gitignore:34` `.env*` + Google key patterns; full `git log --all -p` scan → only documentation mentions of `BEGIN PRIVATE KEY` |
| Unsafe env handling | **Observation** | An **untracked `.env`** exists containing only a `DATABASE_URL` key that **no code references** (origin UNKNOWN — likely injected by the environment; not listed in `.env.example`). Google vars are absent → see §18. No secret values were printed in this report |
| Dependency vulnerabilities | **5 high, dev-only** | `braces` DoS chain via `eslint-config-next`; runtime tree clean |
| Least privilege | **Watch item** | Service-account scope is full `spreadsheets` (read+write, required by CRUD) with Editor access to the whole workbook |

---

## 13. UI/UX Audit

Verified by reading every component/page (plus prior headless-Chrome evidence in `docs/FREEBUFF_AUDIT.md` for responsive overflow: 0 overflows at 375/768/1440 px).

**Strengths**: consistent design tokens; responsive shell with mobile drawer (`app-shell.tsx`); `aria-current="page"` on active nav; loading skeleton (`loading.tsx`); empty states everywhere; search + counters on list pages; **delete confirmation modals** for all destructive actions; busy states disabling buttons during async mutations; `aria-label` on search/filter controls.

**Confirmed problems**

1. **No client-side validation.** `MasterFieldConfig.required` is declared and passed from all 4 master pages but **never rendered or enforced** (`master-crud.tsx`); jobs/finance forms have no required/numeric/date checks; dates are free text `type="text" placeholder="YYYY-MM-DD"` (no picker, no format enforcement). Errors only appear after a server round-trip.
2. **Broken label association.** `Input`/`Select` compute `inputId = id ?? name`; no call site passes either → `<label htmlFor>` points at `undefined`. No `aria-invalid`/`aria-describedby` anywhere. `Input.error` prop exists but is unused by all callers (they hand-roll identical red markup).
3. **Modal a11y**: Esc-to-close works, but **no focus trap, no initial focus, no focus restore**, `aria-label={title}` instead of `aria-labelledby`, and backdrop/Esc dismiss are **not blocked while `busy`** (footer buttons are).
4. **Dropdown a11y**: no Esc, no arrow-key navigation, no `aria-haspopup`/`aria-expanded`; items keyed by `label`; `danger`/`disabled` props unused.
5. **Tabs** (`job-detail-tabs.tsx`) lack `role="tablist"/tab`, `aria-selected`, arrow-key navigation; tab selection is not reflected in the URL (refresh loses the tab).
6. **Duplication**: 3 near-identical CRUD state machines + 2 copies of the Job form (≈120 lines) + repeated error-alert markup (`#e8b4ad/#fdf3f2/#a1352b`) in 8+ places.
7. **Counterparty edit bug**: `jobs-table.tsx` / `edit-job-button.tsx` map `counterparty.type === "UNKNOWN"` → `"CLIENT"` while keeping the previous id → a select with no matching option that still submits a `clientId` (wrong-entity write risk).
8. **Fragile filter**: Finance status filter compares **display labels** as values (`STATUS_FILTER_OPTIONS` in `finance/page.tsx`) — fixed for one label bug in Phase 7 but still label-coupled; expense filter uses raw enums → inconsistent.
9. **Falsy coercion**: `row[col.key] || "-"` renders a legitimate `"0"` as `-`.
10. **UI copy leaks schema**: crew modal text mentions `job_crews.payment` to end users.
11. Delete confirmations in Finance/delivery modals don't name the target row (weaker than master/jobs).
12. `loading.tsx` skeleton has no `role="status"`; `not-found.tsx` hand-rolls a button instead of reusing `<Button>`; sidebar footer still says "Prototype · data mock" although data is live.

---

## 14. Performance Audit

**Top 5 performance problems (ranked)**

1. **Repeated full-worksheet reads per request, no caching/batching.** Every `getAll()` = one full `values.get`; `getById()` = full scan then filter (`google/index.ts:260`). One `/jobs` render performs ≈ **8** Sheets API calls (layout `admins` 1 + `getJobListItems` 4 + `getClients/getVendors/getVenues` 3 — the same three sheets are read twice); `/jobs/[jobNumber]` ≈ **15**; `/finance` ≈ **11**. No per-request memoization, no `values.batchGet`.
2. **Write amplification.** `createJob` performs: 3 × `getById` (full scans) + 1 full read for uniqueness + 1 full read inside `create` + append = **5 full sheet reads for one insert** (`job-service.ts:146-175`).
3. **Static prerender of live-data pages.** Pages are generated at build time (`○ Static`, documented in Phase 2F/7) → data is frozen at build time until `revalidatePath`/rebuild; simultaneously the **build requires live Google credentials** (build-time network dependency). `revalidatePath` inconsistency (§16) makes some pages stale after edits.
4. **No pagination / full dataset shipped to the browser.** Jobs, master lists, and all finance rows are rendered client-side with only keyword filtering; Finance sends both raw and formatted values per row. Cost grows linearly with sheet size.
5. **Bundle/install weight.** `googleapis` = 239 MB installed and is pulled into the server runtime for a single Sheets client; `node_modules` total 845 MB. Cold starts/serverless footprints can be reduced by `google-auth-library` + direct REST (optional, not required).

Also noted: no image assets beyond SVGs (no image-optimization issue), no expensive client-side computation, no unnecessary client re-render hotspots identified beyond normal React state updates.

---

## 15. Testing Audit

| Item | Status |
| --- | --- |
| Test framework | **None** (no vitest/jest/playwright, no `test` script) |
| Unit tests | **0** |
| Integration / API tests | **0** |
| E2E tests | **0** |
| Coverage | **0 %** (no tooling) |
| CI | **None** (`.github` absent) |

Prior phases validated behaviour with **temporary scripts outside the repository** (60 assertions in Phase 7, mapper tests in Phase 2D/2F) — valuable but **not reproducible**, so regressions are undetectable today.

**What must be tested (priority order, high-risk business logic only):**

1. Authentication: login success/failure, session persistence, logout, wrong password, unauthenticated action rejection.
2. Authorization: unauthenticated caller cannot invoke any of the 30 actions; role restrictions.
3. Job creation: Client XOR Vendor invariant (both set / neither set rejected), `job_number` uniqueness, relation existence.
4. Job access control: cross-user/cross-workspace denial (once multi-user exists).
5. Task/Job update: enum validation, not-found IDs, timestamp preservation.
6. Job deletion: **cascade/orphan behaviour** (currently the bug), reference-blocking on master deletes.
7. Mapper unit tests (`mapping.ts` is pure and already the most-tested code — formalize it): header mismatch, number parsing, enum normalization, empty optionals, column shift.
8. Server action validation matrix (mirrors the Phase 7 script: invalid term/type/status/amount/jobId).
9. Finance totals: no double-counting between ClientPayment/VendorPayment/Expense/JobCrew.
10. Database failure handling: Sheets unavailable/misconfigured → graceful error page, not a site-wide 500.

---

## 16. Error Handling & Observability

- **No centralized error handling.** Each action has its own `try/catch` with a duplicated `errorMessage()` helper (4 copies of the same 4-line function).
- **No React error boundaries**: no `src/app/error.tsx`, no `global-error.tsx`. Consequence observed live: when the root layout's Sheets call throws, **all routes (including 404) return HTTP 500** with an unhandled digest.
- **Validation errors**: consistent `{ ok:false, error }` + inline red banner in modals — good UX pattern.
- **Database (Sheets) errors**: wrapped with worksheet/operation context at repository level (`google/index.ts:75-191`) — good for developers, but the same string is shown to end users.
- **Production leak check**: with credentials missing, the client HTML contains no stack trace (Next returns a digest); the **server console does print full stack traces** (acceptable for dev, must be structured/centralized in production). No SQL/env/secret values appear in output. The remaining exposure is *semantic* (worksheet names, row numbers, upstream Google message) via `error.message` → sanitize before returning to clients.
- **Logging: none.** No logger, no request logging, no error tracking (Sentry etc.), no health endpoint.

---

## 17. Code Quality Audit

| Check | Result |
| --- | --- |
| `any` usage | **0** (verified; lint enforces `@typescript-eslint/no-explicit-any`) |
| TODO/FIXME/XXX/HACK | **0** |
| `console.*` | **0** |
| Commented-out code | **0** |
| Duplicated code | **HIGH** — 3× CRUD modal state machine, 2× Job form, 4× `errorMessage`, 8× identical error markup, 2× route-matching logic (`sidebar.tsx`/`topbar.tsx`) |
| Dead code (LOW) | `pageError`/`setPageError` in `master-crud.tsx` (only ever cleared), `LoadingState`/`Spinner` exports unused, `Input.error` prop unused, `DropdownItem.danger/disabled` unused, entire `src/data/mock/**` + `mockRepositories` still bundled into the server build |
| Large components | `job-detail-tabs.tsx` (695 lines, 4 duplicated CRUD blocks), `jobs-table.tsx` (354), `job-service.ts` (362 — repetitive per-entity validation) |
| Magic values (LOW) | Hardcoded hex palette repeated (`#a1352b`, `#e8b4ad`, `#fdf3f2`, `#f0f0f0`, `#fafafa`, `#f5f5f5`, `#2e2e2e`, `#b42318`) instead of design tokens |
| Type safety | Strong: strict mode, no unsafe casts beyond narrow `as` on validated enums, explicit unions instead of `null`-flags in actions |
| Naming/patterns | Consistent (`getX` services, `xAction` server actions, `mapX`/`xToRecord` mappers) |
| Revalidation inconsistency (LOW) | `job-actions.run()` omits `/jobs/[jobNumber]` |

Severity: **duplication = MEDIUM** (maintainability, defect risk on change); the rest LOW/INFO.

---

## 18. Deployment Audit

| Check | Result |
| --- | --- |
| Development startup | Server starts (`Ready in 349 ms`) but **all routes → HTTP 500** (missing Google env) |
| Production build | **FAILS** in this environment: `Export encountered an error on /crew/page` ← `GOOGLE_SHEETS_ID belum diisi` thrown from `layout.tsx:30 → getCurrentAdmin → readSheet`. Root cause = missing `.env.local` credentials (previous phases documented a passing build **with** credentials — not re-verifiable here) |
| Production start | Not reachable (build artifact not produced) |
| Environment variables | `.env.example` documents `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`. Untracked `.env` contains only an unused `DATABASE_URL` (UNKNOWN origin) |
| Migration process | N/A (schema lives in Sheets; headers validated on read — a header change breaks reads loudly by design) |
| Database connection | Sheets API via service account; no connection pooling/caching |
| Health check | **None** |
| Graceful shutdown | Default Next.js behaviour only; no process manager config |
| Logging | **None** |
| Process manager / reverse proxy / HTTPS | **None** in repo (deployment target UNKNOWN) |
| CI/CD | **None** |
| `engines` field | **Missing** (docs say Node 22, environment runs Node 24) |

**Build is the single most urgent operational gap**: today a CI/CD pipeline running `npm ci && npm run build` without Google secrets would fail, and even with secrets the build requires **network access to Google at build time** because pages are statically prerendered while reading live data.

---

## 19. Documentation Audit

| Item | Status |
| --- | --- |
| README | Exists, good architecture/business-rule overview — **but status line says "Phase 2G" while the repo is at Phase 7**, and it does not mention `.env`/Google setup at all |
| Installation | `npm install && npm run dev` only |
| Environment variables | **Not in README** (only `.env.example`, which is not referenced from README) |
| Database setup | Not documented in README (spreadsheet structure lives in the 2 440-line audit doc) |
| Migration instructions | N/A — not documented |
| Development/testing commands | Partial (`typecheck`, `lint`, `build`, `start`); **no test command** |
| Production build/deployment | **Not documented** |
| Architecture overview | Present in README (diagram) + audit doc |
| Audit trail | Excellent: `docs/FREEBUFF_AUDIT.md` (Phases 0–7, decisions, limitations) |

Verdict: documentation is unusually detailed historically but **operationally incomplete and out of date** for a new developer.

---

## 20. Critical Findings

**Confirmed problems (evidence-backed, verified in this session)**

| ID | Severity | Finding |
| --- | --- | --- |
| C1 | CRITICAL | **No authentication**: no login/session/cookie/middleware anywhere; `getCurrentAdmin()` = `admins[0]` for display only |
| C2 | CRITICAL | **App non-functional here**: `npm run build` fails (prerender error) and all routes including 404 return **HTTP 500** because Google Sheets env vars are missing |
| H1 | HIGH | **No authorization model** (no roles/permissions/ownership) — needed even after login is added |
| H2 | HIGH | **Data integrity**: no cascade on job delete (orphans in 5 child sheets), no reference check on master deletes (dangling FKs) |
| H3 | HIGH | **Zero tests / no test framework / no CI**; past validation was non-reproducible external scripts |
| H4 | HIGH | **Non-atomic read-modify-write** on Sheets (row-number updates/deletes, TOCTOU uniqueness) → wrong-row corruption under concurrency |
| H5 | HIGH | **Root layout performs remote IO with no fallback/error boundary** → any Sheets failure (or missing config) 500s every page, including 404 |
| M1 | MEDIUM | Raw `error.message` (worksheet names, row numbers, upstream Google text) returned to browsers |
| M2 | MEDIUM | No rate limiting on 30 mutating actions (Sheets quota abuse; future brute force) |
| M3 | MEDIUM | No security headers (empty `next.config.ts`, no middleware) |
| M4 | MEDIUM | No client-side validation; `required` config dead; free-text dates |
| M5 | MEDIUM | Accessibility: no modal focus trap, broken label association, no dropdown/tab keyboard+ARIA support |
| M6 | MEDIUM | UI duplication: 3× CRUD state machine + 2× Job form + repeated error markup |
| M7 | MEDIUM | No pagination; whole dataset (raw + formatted) shipped to browser; static-prerender staleness |
| M8 | MEDIUM | Performance: 8–15 full-sheet reads per page render, duplicate reads within one request, `getById` = full scan |
| M9 | MEDIUM | Docs: README outdated (Phase 2G vs 7), no env/deployment/test docs |
| L1 | LOW | 5 high dev-only npm advisories (`braces` chain) |
| L2 | LOW | `String.fromCharCode(64+len)` column-letter bug (>26 columns) |
| L3 | LOW | Dead code/unused exports; mock data still bundled |
| L4 | LOW | Magic hex colors repeated 8+ places instead of tokens |
| L5 | LOW | Counterparty `UNKNOWN→CLIENT` edit bug (possible wrong-entity write) |
| L6 | LOW | Schema/table names shown to users (`job_crews.payment` in crew modal copy) |
| L7 | LOW | 6 extraneous packages in `node_modules` (lockfile drift → `npm ci`) |
| L8 | LOW | Node version drift: docs 22 / runtime 24 / `@types/node` 20, no `engines` |
| L9 | LOW | Untracked `.env` with unused `DATABASE_URL` (origin UNKNOWN, no code reference) |
| L10 | LOW | Revalidation inconsistency; label-coupled Finance filter; falsy `|| "-"` coercion; unnamed delete confirmations |
| I1 | INFO | No Docker/CI/health check/process manager/reverse-proxy config |
| I2 | INFO | `googleapis` 239 MB for one Sheets client (optimization opportunity only) |
| I3 | INFO | Single-tenant by design (no workspaces/orgs) — acceptable for scope, must be stated explicitly |

**Missing features (scoped to this domain, not feature-creep)**

- Authentication (login/logout/profile/password) — *expected by any multi-user deployment*.
- Roles/permissions (at minimum: authenticated vs. public; realistically: Admin/Operator/Finance-read).
- Pagination + server-side filtering; cross-entity search.
- Audit/activity history (who changed what — impossible today: no user identity).
- Orphan handling/cascade design; explicit "cannot delete, still referenced" UX.
- Error boundary + config pre-flight; structured logging.
- Job progress/overdue aggregates on Dashboard; assigned-to-me view (needs user identity first).
- Task/TODO, labels, comments, attachments, timeline/schedule — explicitly deferred by prior phases; only build if the product scope expands.

---

## 21. Prioritized Fix List

### P0 — MUST FIX BEFORE PRODUCTION

1. **Restore operability**: provide Google credentials in the target environment; add a **startup config pre-flight** (clear fail-fast message) and an **`error.tsx`/`global-error.tsx` boundary**; decide the rendering strategy (`force-dynamic` for live-data pages vs. build-time credentials) and document it. *Verify by running `npm run build` and hitting every route.*
2. **Authentication**: session-based login for admins (hashing for the existing `admins.password_hash` column), middleware guard on all pages, logout.
3. **Authorization**: reject every server action for unauthenticated callers (server-side, never client-only); define the minimum role model.
4. **Rate limiting + sanitized errors** on mutating actions; stop returning raw repository/Google messages to clients.
5. **Delete integrity**: cascade or explicitly block deletes when references exist (jobs + master entities).
6. **Critical-path tests** once a runner is approved: auth, authz, job invariants, action validation, orphan handling.

### P1 — SHOULD FIX

7. Security headers (CSP, frame, referrer, nosniff, HSTS) in `next.config.ts`.
8. Per-request data memoization / `batchGet`; eliminate duplicate sheet reads; paginate lists.
9. Client-side validation + fix label association (`useId`), modal focus trap, dropdown/tabs ARIA.
10. Extract shared CRUD hook/`JobFormModal`; remove dead code; consistent `revalidatePath`.
11. CI pipeline: `npm ci` → typecheck → lint → test → build.
12. Concurrency hardening for Sheets writes (re-read row position immediately before update/delete; verify `id` uniqueness on read).
13. Documentation: README env setup, run/test/build/deploy, current phase status.

### P2 — IMPROVEMENTS

14. De-duplicate validation into schemas (zod, if approved); dedupe `errorMessage`/error markup; tokenise colors.
15. Fix counterparty edit bug; label-based finance filter; falsy `|| "-"`; unnamed delete modals.
16. Structured logging (pino) + error tracking; health endpoint.
17. Dead code/mock bundling cleanup; `engines` field; `npm ci` to drop extraneous packages; `@types/node` alignment.
18. Dashboard aggregates (overdue/progress), audit/activity log, cross-entity search.

### P3 — OPTIONAL

19. Task/TODO per job, labels/comments/attachments, timeline/schedule, notifications, multi-workspace, `google-auth-library`-based slim client, Prettier.

---

## 22. Recommended Roadmap

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| **A. Operability & Security Foundation** (NEXT) | P0.1–P0.4: env + error boundary + rendering decision + auth + authz guard + rate limit + error sanitisation | build passes; every route 200/404 correctly; unauthenticated action call rejected; security headers present |
| **B. Data Integrity & Safety** | P0.5 cascade/reference rules, concurrency hardening (P1.12), destructive-action confirmations naming targets | orphan tests pass; concurrent write test passes |
| **C. Quality Harness** | test framework + P0.6 critical tests + CI (P1.11) | CI green on typecheck/lint/test/build |
| **D. Performance & UX** | pagination, request memoization, client validation, a11y, CRUD de-duplication | page renders ≤ N sheet reads; axe/focus checks pass |
| **E. Observability & Docs** | logging, health, README/deployment docs | new developer runs the app from docs alone |
| **F. Product expansion** (optional) | dashboard aggregates, audit log, tasks/timeline | scope-approved only |

---

```text
AUDIT STATUS

Overall: NEEDS IMPROVEMENT (architecture sound; security and operability not production-grade)

Production Ready: NO

Critical Issues: 2
High Issues: 5
Medium Issues: 9
Low Issues: 10

Required Packages: 0
Optional Packages: 9

Recommended Next Phase:
Phase A — Operability & Security Foundation
(restore build/runtime with Google credentials + error boundary + rendering strategy,
 then implement server-side authentication and authorization for all 30 server actions,
 plus rate limiting and sanitized error responses)
```

> **Note:** no code, configuration, dependency, or data changes were made during this audit. The working tree is clean (`git status` empty; probe file used for lint verification was removed). Approval is requested before starting Phase A.
