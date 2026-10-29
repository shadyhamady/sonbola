//! Whole-database export / import and reset.
//!
//! A backup is a plain SQLite file (`VACUUM INTO` snapshot), so it is one file the user can copy
//! anywhere. Import validates the file, then replaces the live database through SQLite's online
//! backup API, so the open connection stays valid.

use std::path::Path;
use std::time::Duration;

use rusqlite::backup::Backup;
use rusqlite::{Connection, OpenFlags};

use crate::db;
use crate::error::{AppError, AppResult, invalid};

/// Settings that survive `reset_data` (the bakery's identity, not its records).
const KEPT_SETTINGS: &[&str] = &["bakery_name", "currency_symbol", "currency_decimals", "tank_capacity_l"];

const NOT_A_BACKUP: &str = "الملف ليس نسخة احتياطية صالحة لسنبلة";

fn copy_into(src: &Connection, dst: &mut Connection) -> AppResult<()> {
    Backup::new(src, dst)?.run_to_completion(256, Duration::ZERO, None)?;
    Ok(())
}

/// Writes a consistent snapshot of the database to `path`, replacing any existing file.
pub fn export_to(conn: &Connection, path: &Path) -> AppResult<()> {
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    conn.execute("VACUUM INTO ?1", [path.to_string_lossy().as_ref()])?;
    // Leave the file in rollback-journal mode so it is a single self-contained file.
    let out = Connection::open(path)?;
    out.query_row("PRAGMA journal_mode = DELETE", [], |_| Ok(()))?;
    Ok(())
}

/// Opens `path` read-only and checks that it is a Sonbola database this build can read.
fn open_backup(path: &Path) -> AppResult<Connection> {
    let not_backup = |_| AppError::Validation(NOT_A_BACKUP.to_string());
    let src = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(not_backup)?;
    let version: i64 = src.query_row("PRAGMA user_version", [], |r| r.get(0)).map_err(not_backup)?;
    let tables: i64 = src
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('settings', 'ingredients', 'products', 'sales')",
            [],
            |r| r.get(0),
        )
        .map_err(not_backup)?;
    if tables != 4 || version < 1 {
        return invalid(NOT_A_BACKUP);
    }
    if version > db::SCHEMA_VERSION {
        return invalid("هذه النسخة أحدث من إصدار التطبيق، حدّث سنبلة أولاً");
    }
    let check: String = src.query_row("PRAGMA integrity_check", [], |r| r.get(0)).map_err(not_backup)?;
    if check != "ok" {
        return invalid("ملف النسخة الاحتياطية تالف");
    }
    Ok(src)
}

/// Replaces all data with the backup at `path`. When `safety_copy` is given, the current data is
/// exported there first so a mistaken import can be undone.
pub fn import_from(conn: &mut Connection, path: &Path, safety_copy: Option<&Path>) -> AppResult<()> {
    let src = open_backup(path)?;
    if let Some(p) = safety_copy {
        export_to(conn, p)?;
    }
    copy_into(&src, conn)?;
    drop(src);
    // The file may come from an older schema; also restores WAL mode and foreign keys.
    db::configure(conn)
}

/// Deletes every record and restores the empty starter lists, keeping the bakery name, currency
/// and tank capacity.
pub fn reset_data(conn: &mut Connection) -> AppResult<()> {
    let kept: Vec<(String, String)> = {
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        rows.collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|(k, _)| KEPT_SETTINGS.contains(&k.as_str()))
            .collect()
    };
    let fresh = db::open_in_memory()?;
    copy_into(&fresh, conn)?;
    db::configure(conn)?;
    for (k, v) in kept {
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)", [k, v])?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;
    use crate::services::testutil::*;
    use crate::services::{settings, suppliers};

    fn tmp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("sonbola-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn supplier(c: &Connection, name: &str) {
        suppliers::create_supplier(
            c,
            SupplierInput { id: None, name: name.into(), contact_person: None, phone: None, supplies: None },
        )
        .unwrap();
    }

    fn supplier_count(c: &Connection) -> i64 {
        c.query_row("SELECT COUNT(*) FROM suppliers", [], |r| r.get(0)).unwrap()
    }

    #[test]
    fn export_then_import_restores_state_and_keeps_safety_copy() {
        let dir = tmp("roundtrip");
        let mut live = db::open(&dir.join("live.db")).unwrap();
        let input = base_settings(&live);
        settings::save_settings(&mut live, input).unwrap();
        supplier(&live, "مطاحن");

        let backup = dir.join("backup.sonbola");
        export_to(&live, &backup).unwrap();
        assert!(!dir.join("backup.sonbola-wal").exists());

        supplier(&live, "مورد لاحق");
        assert_eq!(supplier_count(&live), 2);

        let safety = dir.join("before.sonbola");
        import_from(&mut live, &backup, Some(&safety)).unwrap();
        assert_eq!(supplier_count(&live), 1);
        assert_eq!(settings::get_settings(&live).unwrap().bakery_name, "سنبلة");
        // The safety copy still holds the 2 suppliers that the import replaced.
        let before = Connection::open(&safety).unwrap();
        assert_eq!(supplier_count(&before), 2);
        // Connection still writable afterwards.
        supplier(&live, "مورد جديد");
        assert_eq!(supplier_count(&live), 2);
    }

    #[test]
    fn import_rejects_foreign_or_corrupt_files() {
        let dir = tmp("reject");
        let mut live = db::open(&dir.join("live.db")).unwrap();
        supplier(&live, "مطاحن");

        let garbage = dir.join("garbage.sonbola");
        std::fs::write(&garbage, b"definitely not sqlite, just some text padding".repeat(50)).unwrap();
        assert_eq!(err(import_from(&mut live, &garbage, None)), NOT_A_BACKUP);

        let other = dir.join("other.db");
        Connection::open(&other).unwrap().execute_batch("CREATE TABLE t(x); PRAGMA user_version = 1;").unwrap();
        assert_eq!(err(import_from(&mut live, &other, None)), NOT_A_BACKUP);

        let newer = dir.join("newer.sonbola");
        export_to(&live, &newer).unwrap();
        Connection::open(&newer).unwrap().execute_batch("PRAGMA user_version = 99;").unwrap();
        assert!(err(import_from(&mut live, &newer, None)).contains("أحدث"));

        // Nothing was replaced by the failed imports.
        assert_eq!(supplier_count(&live), 1);
    }

    #[test]
    fn reset_clears_records_but_keeps_identity() {
        let dir = tmp("reset");
        let mut live = db::open(&dir.join("live.db")).unwrap();
        let mut input = base_settings(&live);
        input.bakery_name = "مخبز الأمل".into();
        input.currency_symbol = "د.ك".into();
        input.currency_decimals = 3;
        settings::save_settings(&mut live, input).unwrap();
        supplier(&live, "مطاحن");

        reset_data(&mut live).unwrap();

        assert_eq!(supplier_count(&live), 0);
        let s = settings::get_settings(&live).unwrap();
        assert_eq!((s.bakery_name.as_str(), s.currency_symbol.as_str(), s.currency_decimals), ("مخبز الأمل", "د.ك", 3));
        assert!(s.is_configured);
        // Starter lists are back, and the diesel / default-baker settings point at them.
        assert_eq!(s.diesel_ingredient_id, Some(id_of(&live, "ingredients", "ديزل")));
        assert_eq!(s.default_baker_id, Some(id_of(&live, "staff", "رئيس الخبازين")));
    }
}
