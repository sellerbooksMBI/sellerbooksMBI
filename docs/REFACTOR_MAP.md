# SellerBooks source refactor map

Status: audit/mapping only. The legacy files remain the current runtime source until each extraction is verified. Do not remove or reorder script tags as part of a blind cleanup.

## Current inventory (main)

- `index.html`: 5,125 lines; contains the page markup and loads styles/scripts in a deliberate order.
- `css/legacy-01.css` ... `css/legacy-06.css`: six ordered CSS layers; legacy-01 is the main stylesheet (~50 KB), while later files appear to be supplemental/override layers. Preserve cascade order during migration.
- `js/legacy-01.js` ... `js/legacy-09.js`: nine ordered legacy scripts. These are not yet a clean domain-module layout.
- `js/main.js`: ~656 KB, the largest application engine; contains several unrelated feature areas and global functions/state.
- External browser libraries currently loaded by the page include SheetJS/XLSX, ExcelJS, and Supabase JS. Preserve availability and load order until imports are converted and verified.
- Existing `package.json` uses Vite, but the currently deployed HTML references root-relative `/css/... ` and `/js/...` assets. Any bundling change must account for GitHub Pages root deployment and APK/WebView usage.

## Current script/style load order

Styles: `legacy-01.css`, `legacy-02.css`, `legacy-03.css`, `legacy-04.css`, `legacy-05.css`, `legacy-06.css`.

Scripts: `legacy-01.js`, `legacy-02.js`, `legacy-03.js`, external XLSX, external ExcelJS, `legacy-04.js`, external Supabase JS, `main.js`, `legacy-05.js`, `legacy-06.js`, `legacy-07.js`, `legacy-08.js`, `legacy-09.js`.

Important: scripts are currently classic scripts, not ES modules. Inline HTML event handlers call globally available functions. A direct conversion to `type="module"` would change global scope and may break UI events. Keep classic-script compatibility during staged extraction or explicitly expose required functions on `window`.

## Mapping from current large application engine

The following is the first-pass domain map from named section markers/functions in `js/main.js`. Line numbers are approximate and will move as code changes.

| Current region / symbols | Destination module (target) | Dependency / safety notes |
|---|---|---|
| Supabase auth, cloud state, conflict-safe save/load, identity | `js/modules/core/auth.js`, `js/services/supabase-client.js`, `js/services/cloud-state.js` | Highest risk. Preserve per-user isolation, dirty-key merge, conflict detection, and login/redirect behavior. |
| Navigation, pageData, showView, sidebar, browser/mobile back | `js/modules/core/navigation.js` | Keep global entry points used by inline handlers and browser history. |
| Marketplace list/render/save/edit/delete | `js/modules/marketplaces/marketplace-ui.js`, `js/services/marketplace-store.js` | Do not conflate marketplace configuration with connected store accounts. |
| Store accounts, OAuth callbacks, connection status, Shopee/Lazada/Blibli/TikTok sync | `js/modules/stores/store-management.js`, `js/modules/integrations/{shopee,lazada,blibli,tiktok}.js` | Keep OAuth state, per-user account mapping, and API sync isolated. Do not change API/import responsibilities during refactor. |
| Master products, product pagination, product import/export, exchange rates, currency formatting | `js/modules/products/master-products.js`, `js/modules/products/product-import-export.js` | Preserve SKU matching and price source rules. Check shared formatting helpers before moving. |
| Sales import engine, marketplace fingerprints/packing, SKU/QTY preview, column confirmation, duplicate merge, stock decrement | `js/modules/sales/sales-import.js`, `js/modules/sales/marketplace-rules.js`, `js/modules/sales/import-preview.js` | Critical business logic. Manual import remains the dedupe/calculation engine. Do not alter identity keys or marketplace-specific parsing while relocating. |
| Sales import caches, report transaction flattening, report helpers, daily snapshots and timezone logic (also in `legacy-02.js`) | `js/modules/reports/report-data.js`, `js/modules/snapshots/daily-snapshots.js` | Keep Asia/Jakarta day boundaries and immutable past snapshots. Check duplicate definitions across files. |
| Dashboard period/filter, dashboard master-data cache, charts and marketplace performance | `js/modules/dashboard/dashboard.js` | Preserve period semantics and cache invalidation. |
| Product analysis / profit per SKU and report filters | `js/modules/reports/product-analysis.js`, `js/modules/reports/report-filters.js` | Must not change existing formulas or report dropdown behavior. |
| Notifications and low-stock checks | `js/modules/notifications/notifications.js` | Depends on products, identity, imports and translations. |
| Other costs CRUD, formatting, marketplace/store selectors | `js/modules/costs/other-costs.js` | Keep links to store/marketplace IDs and localization. |
| Language, owner identity, settings and display preferences | `js/modules/settings/language.js`, `js/modules/settings/preferences.js` | ID/EN only; account language remains persisted in Supabase, not localStorage as source of truth. |
| CSS | `css/base.css`, `css/layout.css`, `css/components/*.css`, `css/pages/*.css` | First map selectors and duplicate/override rules; preserve current six-file cascade before consolidating. |
| HTML | `index.html` plus optional reusable templates only where safe | Keep IDs/data attributes used by JS. Avoid a redesign or changing login markup while refactoring. |

## Legacy file mapping still to confirm

- `legacy-01.js`: report filters and report initialization (confirmed from function names).
- `legacy-02.js`: large report/data/snapshot helper region (confirmed cache and snapshot identifiers); inspect full boundaries before moving.
- `legacy-03.js`: small standalone helper; identify consumers before assigning a permanent name.
- `legacy-04.js`: Excel library loader/fallback helper.
- `legacy-05.js` to `legacy-09.js`: function-level mapping not yet complete; do not rename based only on file number.

## Recommended extraction order

1. Freeze a known-good commit and preserve the original legacy files.
2. Finish dependency inventory: globals, duplicate function names, event-handler references, script ordering, external library usage, CSS selector ownership.
3. Extract low-risk isolated helpers first (library loader, report filters only after dependencies are known).
4. Extract domain modules behind compatibility wrappers so existing inline handlers keep working.
5. Extract high-risk sales import, cloud synchronization, marketplace OAuth and snapshots last, one domain at a time.
6. After each extraction: syntax/build checks, compare function/global inventories, search for missing IDs/functions, then run focused automated checks. Do not declare release-ready until the full app is tested.

## Guardrails

- No redesign and no change to business calculations during structural refactoring.
- Keep SellerBooks project/config separate from Core Adiimasa and from other client projects.
- Do not copy secrets into source files. Public/publishable Supabase values may be client-visible, but privileged keys must never be in the frontend.
- Keep manual Excel import as the dedupe engine; marketplace API sync should not silently become a second import engine.
- Maintain ID/EN language consistency and account-scoped cloud data.
- The user plans to do full manual acceptance testing only after the refactor is declared ready. Until then, keep the work in audit/refactor stages and clearly distinguish verified checks from user acceptance testing.
