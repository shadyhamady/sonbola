use rusqlite::ErrorCode;
use serde::{Serialize, Serializer};

#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("{0}")]
    Validation(String),
    #[error("العنصر غير موجود")]
    NotFound,
    #[error("خطأ في قاعدة البيانات: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("{0}")]
    Io(#[from] std::io::Error),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

/// Shorthand for an Arabic validation error.
pub fn invalid<T>(msg: &str) -> AppResult<T> {
    Err(AppError::Validation(msg.to_string()))
}

/// Converts a UNIQUE constraint violation into the user-facing "name already used" error.
pub fn map_unique(e: rusqlite::Error) -> AppError {
    if let rusqlite::Error::SqliteFailure(f, Some(msg)) = &e {
        if f.code == ErrorCode::ConstraintViolation && msg.contains("UNIQUE") {
            return AppError::Validation("الاسم مستخدم مسبقاً".to_string());
        }
    }
    AppError::Db(e)
}

/// Maps `QueryReturnedNoRows` to `NotFound`.
pub fn not_found(e: rusqlite::Error) -> AppError {
    match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound,
        other => AppError::Db(other),
    }
}
