# syntax=docker/dockerfile:1
# ── Build stage ────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install dependencies into a dedicated prefix so we can copy them cleanly
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Non-root user for security
RUN adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 8000

# Gunicorn with Uvicorn workers is recommended for production ECS deployments.
# Adjust --workers based on your Fargate vCPU allocation (2 × vCPU + 1 is typical).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
