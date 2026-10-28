use std::collections::HashMap;

use rusqlite::{Connection, OptionalExtension, params};

use crate::error::{AppResult, invalid};
use crate::models::{Settings, SettingsInput};

fn all(conn: &Connection) -> AppResult<HashMap<String, String>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn get_id(conn: &Connection, key: &str) -> AppResult<Option<i64>> {
    let v: Option<String> =
        conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0)).optional()?;
    Ok(v.and_then(|s| s.parse().ok()))
}

pub fn get_settings(conn: &Connection) -> AppResult<Settings> {
    let m = all(conn)?;
    let id = |k: &str| m.get(k).and_then(|v| v.parse::<i64>().ok());
    Ok(Settings {
        bakery_name: m.get("bakery_name").cloned().unwrap_or_default(),
        currency_symbol: m.get("currency_symbol").cloned().unwrap_or_default(),
        currency_decimals: m.get("currency_decimals").and_then(|v| v.parse().ok()).unwrap_or(2),
        diesel_ingredient_id: id("diesel_ingredient_id"),
        tank_capacity_l: m.get("tank_capacity_l").and_then(|v| v.parse().ok()).unwrap_or(1000.0),
        default_baker_id: id("default_baker_id"),
        is_configured: m.contains_key("currency_symbol"),
    })
}

fn put(conn: &Connection, key: &str, value: Option<String>) -> AppResult<()> {
    match value {
        Some(v) => conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, v],
        )?,
        None => conn.execute("DELETE FROM settings WHERE key = ?1", [key])?,
    };
    Ok(())
}

pub fn save_settings(conn: &mut Connection, input: SettingsInput) -> AppResult<Settings> {
    let name = input.bakery_name.trim();
    let symbol = input.currency_symbol.trim();
    if name.is_empty() || symbol.is_empty() {
        return invalid("أدخل اسم المخبز ورمز العملة");
    }
    if ![0, 2, 3].contains(&input.currency_decimals) {
        return invalid("عدد الخانات العشرية غير صالح");
    }
    if !(input.tank_capacity_l > 0.0) {
        return invalid("سعة الخزان يجب أن تكون أكبر من صفر");
    }
    if let Some(id) = input.diesel_ingredient_id {
        let unit: Option<String> =
            conn.query_row("SELECT unit FROM ingredients WHERE id = ?1", [id], |r| r.get(0)).optional()?;
        if unit.as_deref() != Some("l") {
            return invalid("مادة الديزل يجب أن تقاس باللتر");
        }
    }
    if let Some(id) = input.default_baker_id {
        let ok: Option<i64> = conn
            .query_row(
                "SELECT 1 FROM staff WHERE id = ?1 AND archived = 0 AND pay_type = 'production'",
                [id],
                |r| r.get(0),
            )
            .optional()?;
        if ok.is_none() {
            return invalid("الخباز الافتراضي يجب أن يكون من خبازي الإنتاج");
        }
    }
    let tx = conn.transaction()?;
    put(&tx, "bakery_name", Some(name.to_string()))?;
    put(&tx, "currency_symbol", Some(symbol.to_string()))?;
    put(&tx, "currency_decimals", Some(input.currency_decimals.to_string()))?;
    put(&tx, "diesel_ingredient_id", input.diesel_ingredient_id.map(|v| v.to_string()))?;
    put(&tx, "tank_capacity_l", Some(input.tank_capacity_l.to_string()))?;
    put(&tx, "default_baker_id", input.default_baker_id.map(|v| v.to_string()))?;
    tx.commit()?;
    get_settings(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::testutil::*;

    #[test]
    fn seeded_and_saved_settings() {
        let mut c = conn();
        let s = get_settings(&c).unwrap();
        assert!(!s.is_configured);
        assert_eq!(s.diesel_ingredient_id, Some(id_of(&c, "ingredients", "ديزل")));
        assert_eq!(s.default_baker_id, Some(id_of(&c, "staff", "رئيس الخبازين")));
        assert_eq!(s.tank_capacity_l, 1000.0);

        let mut input = base_settings(&c);
        input.diesel_ingredient_id = Some(id_of(&c, "ingredients", "دقيق"));
        assert_eq!(err(save_settings(&mut c, input)), "مادة الديزل يجب أن تقاس باللتر");
        let mut input = base_settings(&c);
        input.default_baker_id = Some(id_of(&c, "staff", "كاشير"));
        assert_eq!(err(save_settings(&mut c, input)), "الخباز الافتراضي يجب أن يكون من خبازي الإنتاج");

        let input = base_settings(&c);
        let s = save_settings(&mut c, input).unwrap();
        assert!(s.is_configured);
        assert_eq!(s.currency_symbol, "ر.س");
    }
}
