//! Management PIN with an offline recovery code.
//!
//! This is a UI lock for a shared counter computer, not encryption: the database file itself is
//! not protected. PIN and recovery code are stored only as salted SHA-256 hashes. Because the app
//! is offline there is no "email me a reset", so enabling the PIN also issues a one-time recovery
//! code that the owner writes down; it resets the PIN and is replaced by a fresh one.

use std::time::Duration;

use rusqlite::{Connection, OptionalExtension};
use sha2::{Digest, Sha256};

use crate::error::{AppResult, invalid};
use crate::models::{ResetPinInput, SetPinInput};

pub const KEYS: &[&str] = &["pin_salt", "pin_hash", "recovery_salt", "recovery_hash"];
const ALPHABET: &[u8; 32] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/// Slows guessing: every wrong attempt costs this long.
const FAIL_DELAY: Duration = Duration::from_millis(500);

fn get(conn: &Connection, key: &str) -> AppResult<Option<String>> {
    Ok(conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0)).optional()?)
}

fn put(conn: &Connection, key: &str, value: &str) -> AppResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value],
    )?;
    Ok(())
}

fn digest(salt: &str, secret: &str) -> String {
    let h = Sha256::digest(format!("{salt}:{secret}").as_bytes());
    h.iter().map(|b| format!("{b:02x}")).collect()
}

fn random_hex(conn: &Connection) -> AppResult<String> {
    Ok(conn.query_row("SELECT hex(randomblob(16))", [], |r| r.get(0))?)
}

/// `XXXX-XXXX-XXXX-XXXX` from 16 random bytes (32-symbol alphabet, so no modulo bias).
fn new_recovery_code(conn: &Connection) -> AppResult<String> {
    let hex = random_hex(conn)?;
    let chars: Vec<char> = (0..16)
        .map(|i| {
            let byte = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).unwrap_or(0);
            ALPHABET[(byte % 32) as usize] as char
        })
        .collect();
    Ok(chars.chunks(4).map(|c| c.iter().collect::<String>()).collect::<Vec<_>>().join("-"))
}

fn normalize_code(code: &str) -> String {
    code.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_ascii_uppercase()
}

pub fn is_enabled(conn: &Connection) -> AppResult<bool> {
    Ok(get(conn, "pin_hash")?.is_some())
}

fn valid_pin(pin: &str) -> AppResult<()> {
    if (4..=8).contains(&pin.len()) && pin.chars().all(|c| c.is_ascii_digit()) {
        Ok(())
    } else {
        invalid("رمز الدخول يجب أن يكون من 4 إلى 8 أرقام")
    }
}

fn check(conn: &Connection, salt_key: &str, hash_key: &str, secret: &str) -> AppResult<bool> {
    let (Some(salt), Some(hash)) = (get(conn, salt_key)?, get(conn, hash_key)?) else {
        return Ok(false);
    };
    let ok = digest(&salt, secret) == hash;
    if !ok {
        std::thread::sleep(FAIL_DELAY);
    }
    Ok(ok)
}

/// True when the PIN is correct (or no PIN is set).
pub fn verify_pin(conn: &Connection, pin: &str) -> AppResult<bool> {
    if !is_enabled(conn)? {
        return Ok(true);
    }
    check(conn, "pin_salt", "pin_hash", pin)
}

fn store(conn: &Connection, pin: &str) -> AppResult<String> {
    let (pin_salt, rec_salt) = (random_hex(conn)?, random_hex(conn)?);
    let code = new_recovery_code(conn)?;
    put(conn, "pin_salt", &pin_salt)?;
    put(conn, "pin_hash", &digest(&pin_salt, pin))?;
    put(conn, "recovery_salt", &rec_salt)?;
    put(conn, "recovery_hash", &digest(&rec_salt, &normalize_code(&code)))?;
    Ok(code)
}

/// Sets or changes the PIN (changing needs the current one) and returns a new recovery code.
pub fn set_pin(conn: &mut Connection, input: SetPinInput) -> AppResult<String> {
    valid_pin(&input.new_pin)?;
    if is_enabled(conn)? && !verify_pin(conn, input.current_pin.as_deref().unwrap_or(""))? {
        return invalid("رمز الدخول الحالي غير صحيح");
    }
    let tx = conn.transaction()?;
    let code = store(&tx, &input.new_pin)?;
    tx.commit()?;
    Ok(code)
}

pub fn remove_pin(conn: &mut Connection, pin: &str) -> AppResult<()> {
    if !verify_pin(conn, pin)? {
        return invalid("رمز الدخول غير صحيح");
    }
    for k in KEYS {
        conn.execute("DELETE FROM settings WHERE key = ?1", [k])?;
    }
    Ok(())
}

/// Forgotten PIN: the recovery code authorises a new PIN and issues a fresh recovery code.
pub fn reset_pin(conn: &mut Connection, input: ResetPinInput) -> AppResult<String> {
    valid_pin(&input.new_pin)?;
    if !is_enabled(conn)? {
        return invalid("لا يوجد رمز دخول لإعادة تعيينه");
    }
    if !check(conn, "recovery_salt", "recovery_hash", &normalize_code(&input.recovery_code))? {
        return invalid("رمز الاسترداد غير صحيح");
    }
    let tx = conn.transaction()?;
    let code = store(&tx, &input.new_pin)?;
    tx.commit()?;
    Ok(code)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;

    fn set(c: &mut Connection, new: &str, current: Option<&str>) -> AppResult<String> {
        set_pin(c, SetPinInput { new_pin: new.into(), current_pin: current.map(String::from) })
    }

    #[test]
    fn pin_lifecycle_and_recovery() {
        let mut c = conn();
        assert!(!is_enabled(&c).unwrap() && verify_pin(&c, "anything").unwrap());

        assert!(err(set(&mut c, "12", None)).contains("4 إلى 8"));
        assert!(err(set(&mut c, "12ab", None)).contains("4 إلى 8"));
        let code = set(&mut c, "1234", None).unwrap();
        assert_eq!(code.len(), 19);
        assert!(code.split('-').all(|g| g.len() == 4 && g.chars().all(|ch| ALPHABET.contains(&(ch as u8)))));
        assert!(is_enabled(&c).unwrap());
        // Neither secret is stored in the clear.
        let stored: String = c
            .query_row("SELECT group_concat(value) FROM settings WHERE key IN ('pin_hash','recovery_hash','pin_salt','recovery_salt')", [], |r| r.get(0))
            .unwrap();
        assert!(!stored.contains("1234") && !stored.contains(&code));

        assert!(verify_pin(&c, "1234").unwrap());
        assert!(!verify_pin(&c, "0000").unwrap());

        // Changing needs the current PIN and issues a new recovery code.
        assert_eq!(err(set(&mut c, "5678", Some("0000"))), "رمز الدخول الحالي غير صحيح");
        assert_eq!(err(set(&mut c, "5678", None)), "رمز الدخول الحالي غير صحيح");
        let code2 = set(&mut c, "5678", Some("1234")).unwrap();
        assert!(verify_pin(&c, "5678").unwrap() && !verify_pin(&c, "1234").unwrap());
        assert_ne!(code, code2);

        // Forgotten PIN: old code no longer works, the current one does (case/dash insensitive).
        let reset = |c: &mut Connection, code: &str| reset_pin(c, ResetPinInput { recovery_code: code.into(), new_pin: "9999".into() });
        assert_eq!(err(reset(&mut c, &code)), "رمز الاسترداد غير صحيح");
        let code3 = reset(&mut c, &code2.to_lowercase().replace('-', " ")).unwrap();
        assert!(verify_pin(&c, "9999").unwrap() && !verify_pin(&c, "5678").unwrap());
        assert_ne!(code2, code3);
        assert_eq!(err(reset(&mut c, &code2)), "رمز الاسترداد غير صحيح");

        assert_eq!(err(remove_pin(&mut c, "1111")), "رمز الدخول غير صحيح");
        remove_pin(&mut c, "9999").unwrap();
        assert!(!is_enabled(&c).unwrap());
        assert!(err(reset(&mut c, &code3)).contains("لا يوجد"));
    }

    #[test]
    fn reset_data_keeps_the_pin() {
        let mut c = conn();
        set(&mut c, "1234", None).unwrap();
        crate::services::backup::reset_data(&mut c).unwrap();
        assert!(verify_pin(&c, "1234").unwrap() && !verify_pin(&c, "1").unwrap());
    }
}
