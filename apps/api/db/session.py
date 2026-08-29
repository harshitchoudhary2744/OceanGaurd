"""
Database Session and Engine Configuration for OceanGuard
Supports PostgreSQL + PostGIS (including Supabase Cloud PostGIS) with graceful offline fallback.
"""
import os
import logging
from typing import Generator, Optional
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

logger = logging.getLogger("oceanguard.db")

# Automatically load .env if present
def _load_env():
    try:
        from dotenv import load_dotenv
        cur = Path(__file__).resolve()
        for parent in [cur.parent, cur.parent.parent, cur.parent.parent.parent, cur.parent.parent.parent.parent]:
            env_file = parent / ".env"
            if env_file.exists():
                load_dotenv(dotenv_path=env_file, override=False)
                break
    except Exception:
        pass

_load_env()

raw_db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DATABASE_URL") or os.getenv("SUPABASE_DB_URL") or "postgresql://oceanguard:oceanguard123@localhost:5432/oceanguard_db"

# Handle SQLAlchemy postgres:// vs postgresql:// compatibility (Supabase defaults to postgres:// in some URIs)
if raw_db_url.startswith("postgres://"):
    DATABASE_URL = raw_db_url.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = raw_db_url

# Engine and Session initialization
engine = None
SessionLocal = None
_db_available = False
_is_supabase = "supabase" in DATABASE_URL.lower()

try:
    connect_args = {"connect_timeout": 5}
    if _is_supabase or "sslmode" in DATABASE_URL:
        # Supabase requires SSL
        if "sslmode" not in DATABASE_URL:
            if "?" in DATABASE_URL:
                DATABASE_URL += "&sslmode=require"
            else:
                DATABASE_URL += "?sslmode=require"

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args=connect_args
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    # Test connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        _db_available = True
        provider = "Supabase Cloud PostGIS" if _is_supabase else "PostgreSQL/PostGIS"
        logger.info(f"Successfully connected to {provider} database.")
except Exception as e:
    masked_url = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
    logger.warning(f"Database at @{masked_url} not reachable: {e}. Standalone fallback store enabled.")
    _db_available = False


def is_db_available() -> bool:
    """Check if the live PostgreSQL / Supabase database is connected and available."""
    global _db_available, engine
    if not _db_available:
        try:
            if engine is None:
                engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 3})
                global SessionLocal
                SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                _db_available = True
        except Exception:
            _db_available = False
    return _db_available


def get_db_info() -> dict:
    """Diagnostic info for healthcheck."""
    masked_url = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else "localhost:5432"
    return {
        "connected": is_db_available(),
        "provider": "Supabase Managed PostGIS" if _is_supabase else "Local/Dedicated PostgreSQL",
        "endpoint": masked_url.split("?")[0],
    }


def get_db() -> Generator[Optional[Session], None, None]:
    """FastAPI Dependency for database sessions."""
    if not is_db_available() or SessionLocal is None:
        yield None
        return

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
