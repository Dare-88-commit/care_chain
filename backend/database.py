from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite database URL - this creates the DB in your project root
SQLALCHEMY_DATABASE_URL = "sqlite:///./carechain.db"

# Critical settings:
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=True  # Leave this True to see SQL in console
)

# This MUST be after engine creation
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# This creates your Base class
Base = declarative_base()

# Add this function


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Add this initialization function


def initialize_database():
    print("⚠️ FORCE CREATING ALL TABLES ⚠️")
    Base.metadata.create_all(bind=engine)
