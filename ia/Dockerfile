FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /opt/luxpopuli-ia

RUN pip install --no-cache-dir \
    fastapi==0.162.3 \
    "uvicorn[standard]==0.54.0"

COPY *.py ./
COPY knowledge_validated/ ./knowledge_validated/

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
