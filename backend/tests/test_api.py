def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_get_sources(client, pmd_source):
    response = client.get("/api/v1/sources")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "PMD Weather"

def test_admin_auth(client):
    response = client.get("/api/v1/admin/alerts/pending")
    # Missing header
    assert response.status_code == 422 # Unprocessable entity due to missing required header
    
    response = client.get("/api/v1/admin/alerts/pending", headers={"x-admin-api-key": "wrong"})
    assert response.status_code == 401
    
    # We need settings.ADMIN_API_KEY. It defaults to "change-me" in .env.example, 
    # but in test environment it's whatever pydantic loads.
    from app.core.config import settings
    response = client.get("/api/v1/admin/alerts/pending", headers={"x-admin-api-key": settings.ADMIN_API_KEY})
    assert response.status_code == 200
    assert isinstance(response.json(), list)
