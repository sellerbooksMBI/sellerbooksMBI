# SellerBooks Modularization — Phase 1

## Objective
Refactor the copied SellerBooks application incrementally while preserving current behavior. The production `main` branch and the old SellerBooks repository/domain must remain untouched until changes are reviewed and tested.

## Baseline confirmed from repository inspection
- `index.html` loads CSS files `css/legacy-01.css` through `css/legacy-06.css`.
- `index.html` loads classic JavaScript files in order: `js/legacy-01.js`, `js/legacy-02.js`, `js/legacy-03.js`, third-party spreadsheet libraries, `js/legacy-04.js`, Supabase CDN, `js/main.js`, then `js/legacy-05.js` through `js/legacy-09.js`.
- `js/main.js` is the largest file (approximately 21,685 lines in the inspected version) and contains cloud state, storage/cache, persistence, synchronization/conflict handling, and application data logic.
- `js/legacy-02.js` is approximately 4,692 lines and includes report filters/rendering, transaction handling, financial calculations, daily snapshots, exports, and sold-product analysis.
- `js/legacy-01.js` contains dialog helpers and report filter/initialization behavior.
- `js/legacy-03.js` contains packing modal/settings helpers.
- `js/legacy-04.js` provides a script-loading helper.
- `js/legacy-05.js` includes device/browser detection and analytics.
- `js/legacy-07.js` and `js/legacy-08.js` contain receivables (piutang) UI/local logic and cloud sync/realtime/polling respectively.
- `js/legacy-09.js` contains language/hide helpers.
- `package.json` includes Vite build scripts and dependencies. Despite that, application files currently use a classic-script/global style; module conversion must not assume ES module imports are safe.

## Proposed module boundaries (target architecture)
1. **Core state and storage** — local storage abstraction, IndexedDB cache, legacy migration.
2. **Cloud persistence and synchronization** — Supabase reads/writes, dirty tracking, save queue, realtime/conflict handling, concurrent snapshots.
3. **Sales import and identity** — import keys, deduplication/merge, import state and import workflow.
4. **Reports and filters** — report date range, marketplace/store filters, selection/pagination, rendering.
5. **Financial calculations and snapshots** — fee/HPP/profit calculations and daily snapshot rules.
6. **Product analysis and exports** — sold-product analysis and PDF/export helpers.
7. **Feature modules** — packing and receivables, separated from core infrastructure.
8. **UI shell and localization** — dialogs, navigation, language helpers, responsive styles.

These are target boundaries, not claims that the code has already been moved. Exact function ownership and dependencies must be verified before moving code.

## Safe implementation sequence
- Phase 1: document script order, public globals, cross-file dependencies, and current baseline.
- Phase 2: add dependency/ownership inventory and choose the lowest-risk self-contained module.
- Phase 3: extract one module at a time while preserving classic-script compatibility initially.
- Phase 4: run Vite build and browser smoke tests after each extraction.
- Phase 5: only consider ES modules after dependency boundaries are explicit and tests pass.

## Regression checklist
- Login/logout and ID/EN language persistence.
- Supabase connection and per-account data isolation.
- Marketplace connection and order pulling, including concurrent clients.
- Manual Excel import, deduplication, and snapshot fields.
- Report filters, profit/HPP/fees, sold-product analysis, daily snapshot locking.
- Delete-report and other destructive actions, including progress/error feedback.
- Receivables, packing settings, exports, mobile layout, and offline behavior.

## Safety rules
- Do not edit the old SellerBooks repository or switch the custom domain during refactoring.
- Do not change calculations, database schemas, API behavior, or business rules as part of a pure extraction.
- Preserve load order and global function names until callers are mapped.
- Prefer a reviewable pull request over direct changes to `main`.
- Never report a build or runtime test as passing unless it was actually run.
