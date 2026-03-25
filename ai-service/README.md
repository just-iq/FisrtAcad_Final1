# FirstAcad AI Service (FastAPI)

Implements **prioritization**, **extractive summarization**, and **resource recommendations** without using LLM APIs.

## Environment
Create `ai-service/.env` (copy from `ai-service/env.example`):

- `ENV=development`
- `DATABASE_URL=postgres://USER:PASS@localhost:5432/firstacad`
- `EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2`

## Setup & Run
```bash
cd ai-service
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Endpoints
- `GET /health`
- `POST /analyze/announcement`
  - Request: `{ "id": "...", "title": "...", "body": "..." }`
  - Response: `{ "priority": "HIGH|MEDIUM|LOW", "summary": "...|null", "score": 0.0 }`
- `GET /recommend/resources/{student_id}`
  - Response: `{ "recommended_resource_ids": ["..."], "scores": [0.0] }`

# FirstAcad AI Service (FastAPI)

AI/ML microservice for FirstAcad. Provides:

- `GET /health`
- `POST /analyze/announcement`
- `GET /recommend/resources/{student_id}`

## Running (dev)

1. Create a virtualenv and install deps:

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Set environment:

- `DATABASE_URL` (e.g. `postgres://postgres:postgres@localhost:5432/firstacad`)
- `PORT` (optional; default `8000`)

3. Start:

```bash
uvicorn main:app --reload --port 8000
```

## Notes

- Embeddings are implemented using TF-IDF vectors (no external model downloads).
- Announcement priority uses a lightweight heuristic score, designed to be swapped for a trained model later.
- Recommendations combine content similarity + interaction co-occurrence.

