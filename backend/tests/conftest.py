import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.base import Base
from app.database.models import * # Import all to register with Base
from app.database.models.source import Source
from fastapi.testclient import TestClient
from app.main import app
import httpx
from datetime import datetime, timezone

@pytest.fixture(scope="session")
def engine():
    return create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

@pytest.fixture(scope="session")
def tables(engine):
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session(engine, tables):
    connection = engine.connect()
    transaction = connection.begin()
    session_factory = sessionmaker(bind=connection, autocommit=False, autoflush=False)
    session = session_factory()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db_session):
    from app.database.session import get_db
    
    def override_get_db():
        yield db_session
        
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture
def pmd_source(db_session):
    source = Source(
        name="PMD Weather",
        base_url="https://www.pmd.gov.pk/en/",
        scrape_url="https://www.pmd.gov.pk/en/latest-weather-alerts.php",
        source_type="HTML",
        is_active=True,
        polling_interval_minutes=20,
        last_checked_at=datetime.now(timezone.utc)
    )
    db_session.add(source)
    db_session.commit()
    return source
