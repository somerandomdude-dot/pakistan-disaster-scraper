from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.database.models.source import Source
from app.schemas.source import Source as SourceSchema

router = APIRouter()

@router.get("/", response_model=List[SourceSchema])
def get_sources(db: Session = Depends(get_db)):
    sources = db.query(Source).all()
    return sources
