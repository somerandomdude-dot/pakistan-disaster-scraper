#!/bin/bash
set -e

echo "Starting 10x Comprehensive Test Suite..."
for i in {1..10}; do
  echo "--- RUN $i/10 ---"
  
  echo "Running Frontend Tests (Vitest)..."
  cd /run/media/hassan/storage/scraper/frontend
  npx vitest run --passWithNoTests
  
  echo "Running Backend Tests (Pytest)..."
  cd /run/media/hassan/storage/scraper/backend
  source venv/bin/activate
  PYTHONPATH=. pytest -q
  
  echo "Run $i passed successfully."
done

echo "ALL 10 RUNS PASSED SUCCESSFULLY!"
