FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY seed.py ./seed.py
COPY bootstrap.py ./bootstrap.py
COPY migrate_db.py ./migrate_db.py

RUN useradd --create-home --uid 10001 appuser && \
    mkdir /app/storage && \
    chown -R appuser:appuser /app

USER appuser
EXPOSE 8000

CMD ["sh", "-c", "python bootstrap.py && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${UVICORN_WORKERS:-2}"]
