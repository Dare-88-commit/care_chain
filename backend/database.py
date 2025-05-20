from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ✅ Neon PostgreSQL connection string
SQLALCHEMY_DATABASE_URL = "postgresql://Carechain_db_owner:npg_2HjZpqi5PFae@ep-ancient-morning-a5tb8edd-pooler.us-east-2.aws.neon.tech/Carechain_db?sslmode=require"

# ✅ Create engine — no `connect_args` needed for PostgreSQL
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=True  # Optional: print SQL queries to console
)

# ✅ Set up Session and Base
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ✅ Dependency for getting a DB session (use in FastAPI routes)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ✅ Initialize tables (create all defined models)
def initialize_database():
    print("⚠️ FORCE CREATING ALL TABLES ⚠️")
    Base.metadata.create_all(bind=engine)
