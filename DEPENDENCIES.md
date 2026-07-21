# Project Dependencies

This document outlines all the dependencies required to run the Pakistan Natural-Disaster Alert Scraper and Dashboard.

## Infrastructure & Environment
These are the system-level requirements to run the project via the provided Docker configuration.

- **Docker** (v24+)
- **Docker Compose** (v2+)
- **PostgreSQL** (v15+) - *Automatically provisioned via Docker*

---

## Backend Dependencies
The backend is built using Python 3.12 and relies on the following libraries (listed in `backend/requirements.txt`):

### Core Framework & API
- **FastAPI** (`fastapi==0.111.1`): High-performance web framework for building APIs.
- **Uvicorn** (`uvicorn[standard]==0.30.1`): ASGI web server implementation for Python.
- **Pydantic** (`pydantic==2.8.2`): Data validation and settings management.
- **Pydantic Settings** (`pydantic-settings==2.3.4`): Configuration management.

### Database & ORM
- **SQLAlchemy** (`sqlalchemy==2.0.31`): SQL toolkit and Object-Relational Mapping (ORM) library.
- **Psycopg 3** (`psycopg[binary,pool]>=3.2.10`): PostgreSQL database adapter for Python.
- **Alembic** (`alembic==1.13.2`): Database migration tool for SQLAlchemy.

### Scraping & Parsing
- **HTTPX** (`httpx==0.27.0`): Fully featured HTTP client for Python 3 (used for making requests to official sources).
- **BeautifulSoup4** (`beautifulsoup4==4.12.3`): HTML parsing library for extracting data from websites (NDMA, FFD).
- **PyMuPDF** (`pymupdf==1.24.7`): PDF parsing library to extract text from advisory PDFs (PMD).

### Task Scheduling & Utilities
- **APScheduler** (`apscheduler==3.10.4`): Advanced Python Scheduler for running background scraper jobs at set intervals.
- **python-dateutil** (`python-dateutil==2.9.0.post0`): Powerful extensions to the standard datetime module.

### Testing (Dev)
- **pytest** (`pytest==8.2.2`)
- **pytest-asyncio** (`pytest-asyncio==0.23.7`)
- **pytest-httpx** (`pytest-httpx==0.30.0`)

---

## Frontend Dependencies
The frontend is a React-based application built with Next.js (listed in `frontend/package.json`).

### Core Framework
- **Next.js** (`next@16.2.11`): React framework with App Router and Server-Side Rendering (SSR).
- **React** (`react@19.2.4`) & **React DOM** (`react-dom@19.2.4`): Core UI libraries.

### Data Fetching & State
- **Axios** (`axios@^1.6.0`): Promise-based HTTP client for the browser.
- **TanStack React Query** (`@tanstack/react-query@^5.0.0`): Asynchronous state management and data caching.
- **Zod** (`zod@^3.22.0`): TypeScript-first schema declaration and validation library.

### Mapping & Visualization
- **Leaflet** (`leaflet@^1.9.4`): Open-source JavaScript library for mobile-friendly interactive maps.
- **React-Leaflet** (`react-leaflet@^4.2.1`): React components for Leaflet maps.

### Styling & UI
- **Tailwind CSS v4** (`tailwindcss@^4`): Utility-first CSS framework.
- **Lucide React** (`lucide-react@^0.300.0`): Clean and consistent icon library.
- **Tailwind Merge** (`tailwind-merge@^2.2.0`): Utility to efficiently merge Tailwind CSS classes without style conflicts.
- **clsx** (`clsx@^2.1.0`): Utility for constructing `className` strings conditionally.

### Utilities
- **date-fns** (`date-fns@^3.0.0`): Modern JavaScript date utility library.

### Development Tools (Dev)
- **TypeScript** (`typescript@^5`)
- **ESLint** (`eslint@^9`)
- **Various Types**: `@types/node`, `@types/react`, `@types/react-dom`, `@types/leaflet`
