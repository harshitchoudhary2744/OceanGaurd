"""
Database Session and Engine Configuration for OceanGuard
Supports PostgreSQL + PostGIS with graceful offline fallback.
"""
import os
import logging
from typing import Generator, Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import OperationalError

logger = logging.getLogger("oceanguard.db")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://oceanguard:oceanguard123@localhost:5432/oceanguard_db"
)

# Engine and Session initialization
engine = None
SessionLocal = None
_db_available = False

try:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        connect_args={"connect_timeout": 3}
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    # Test connection
    with engine.connect() as conn:
        _db_available = True
        logger.info("Successfully connected to PostgreSQL/PostGIS database.")
except Exception as e:
    logger.warning(f"PostgreSQL not reachable at {DATABASE_URL}: {e}. Standalone fallback store enabled.")
    _db_available = False


def is_db_available() -> bool:
    """Check if the live PostgreSQL database is connected and available."""
    global _db_available, engine
    if not _db_available:
        try:
            if engine is None:
                engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"connect_timeout": 2})
                global SessionLocal
                SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            with engine.connect() as conn:
                _db_available = True
        except Exception:
            _db_available = False
    return _db_available


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
