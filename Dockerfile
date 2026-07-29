FROM python:3.12-slim

# HuggingFace Spaces strictly requires running as a non-root user (User 1000)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Install dependencies from the backend folder
COPY --chown=user backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend source code
COPY --chown=user backend/ .

# HuggingFace Spaces strictly requires the app to bind to port 7860
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 7860
