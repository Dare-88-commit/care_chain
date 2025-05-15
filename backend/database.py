from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Using SQLite for easier local development
DATABASE_URL = "sqlite:///./carechain.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()
