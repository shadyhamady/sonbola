use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;

use crate::error::AppError;

static MIGRATIONS: &[&str] = &[include_str!("../migrations/0001_init.sql")];

/// Number of schema migrations this build knows; a backup with a higher `user_version` is too new.
pub const SCHEMA_VERSION: i64 = MIGRATIONS.len() as i64;

pub fn open(path: &Path) -> Result<Connection, AppError> {
    let mut conn = Connection::open(path)?;
    configure(&mut conn)?;
    Ok(conn)
}

pub fn open_in_memory() -> Result<Connection, AppError> {
    let mut conn = Connection::open_in_memory()?;
    configure(&mut conn)?;
    Ok(conn)
}

pub fn configure(conn: &mut Connection) -> Result<(), AppError> {
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    migrate(conn)
}

fn migrate(conn: &mut Connection) -> Result<(), AppError> {
    let current: usize = conn.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))? as usize;
    for (i, sql) in MIGRATIONS.iter().enumerate().skip(current) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.execute_batch(&format!("PRAGMA user_version = {}", i + 1))?;
        tx.commit()?;
    }
    Ok(())
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
