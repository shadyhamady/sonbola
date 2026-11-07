# سنبلة (Sonbola)

Desktop bakery manager: point of sale with cash-drawer shifts, inventory, recipes and product costing,
purchases and supplier payables, production with per-production baker pay, payroll, expenses, oven diesel
log, manual daily sales, dashboard and cash-view P&L reports. Arabic (RTL) UI.

Stack: Tauri v2 · React 19 + TypeScript · Mantine 9 · SQLite (rusqlite, bundled).

## Develop

Prerequisites: Node 22, pnpm, Rust (stable), Xcode command-line tools on macOS.

```sh
pnpm install
pnpm tauri dev        # run the app
pnpm test             # frontend unit tests (vitest)
cd src-tauri && cargo test   # backend service tests
```

## Build

```sh
pnpm tauri build      # macOS: src-tauri/target/release/bundle/{macos,dmg}
```

Windows and Linux installers are built by `.github/workflows/release.yml` when a `v*` tag is pushed
(e.g. `git tag v0.1.0 && git push --tags`); the workflow creates a draft GitHub release.

## Data

All data lives in one SQLite file, `sonbola.db`, in the app data directory
(macOS: `~/Library/Application Support/com.sonbola.app/`). Back it up by copying the file while the app is closed.
Schema migrations are in `src-tauri/migrations/` and run on startup (`PRAGMA user_version`).

## Layout

- `src-tauri/src/services/` — business rules (costing, production, purchases, shifts, reports…), unit-tested.
- `src-tauri/src/commands.rs` — one Tauri command per service function.
- `src/api/` — typed command wrappers and Arabic labels; `src/pages/`, `src/pos/` — screens.
- `src/lib/costing.ts` mirrors the Rust `unit_costs` formula for live previews; keep them in sync.

## First run, demo data and backups

- On first launch the app asks for the bakery name and currency. The **إضافة بيانات تجريبية** switch loads a week of
  purchases, production, shifts, sales, expenses and diesel logs so you can explore; **الإعدادات → مسح البيانات التجريبية**
  removes it (and anything added since) and keeps the name/currency.
- **الإعدادات → النسخ الاحتياطي**: *تصدير* writes all data to one `.sonbola` file (a SQLite snapshot); *استيراد*
  replaces the current data with a chosen file (also offered on the first-run screen). Before every import the current data is
  saved to `backups/before-import-<time>.sonbola` in the app data folder.

## Management PIN, product units and production entry

- **الإعدادات → رمز دخول الإدارة** protects the management area with a 4–8 digit PIN (the POS stays open). Activating it
  shows a one-time **recovery code**; since the app is offline, that code is the only way to reset a forgotten PIN
  («نسيت الرمز؟» on the PIN prompt), and each reset issues a new code. The PIN and code are stored as salted hashes; this is a
  screen lock, not encryption of the database file. Clearing demo data keeps the PIN.
- **Product units**: each product has a unit of measure (حبة, كغ, غ, لتر, مل, عبوة, صينية), chosen in the product form.
  The recipe yield, price, cost, stock, low-stock level, production, POS quantity, adjustments and reports are all in that
  unit. Count units (حبة, عبوة, صينية) take whole numbers; weight and volume units take up to 3 decimals (e.g. 0.75 كغ at
  the POS). The unit is locked once the product has a production, sale or stock adjustment.
- **الإنتاج** can be entered in the product's unit, in batches, or as kg of dough. Dough weight is converted to the
  product's unit through the recipe (full dough weight, or the weight of one chosen ingredient such as flour); the history
  shows both.
