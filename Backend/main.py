"""
main.py
FastAPI entrypoint. Run with:  uvicorn main:app --reload
Swagger UI:  http://127.0.0.1:8000/docs

load_dotenv() must run FIRST, before `routes` (and everything routes
imports — agent1..agent5, orchestrator, memory) is imported, since
memory.py reads COCKROACH_* env vars at call time but other modules may
read env vars at import time. Doing this first guarantees .env values are
already in os.environ no matter when each module reads them.

On AWS Lambda this load_dotenv() call is a harmless no-op (there's no
.env file deployed) — env vars are instead set directly in the Lambda
console under Configuration > Environment variables.
"""
import os
import logging

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from routes import router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Sentinel - Global Resource Response AI",
    description="Multi-agent API for geopolitical risk, scenario simulation, "
                "route optimization, decision advice, and procurement.",
    version="1.0.0",
)

# CORS: without this, a frontend on a different origin/port can't call this
# API at all — the browser blocks it before the request even lands here.
# Set ALLOWED_ORIGINS in .env as a comma-separated list once you know your
# frontend's real origin(s); "*" is fine for local dev only.
_allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
origins = [o.strip() for o in _allowed_origins.split(",")] if _allowed_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],  # credentials + wildcard origin is invalid together
    allow_methods=["*"],
    allow_headers=["*"],
)

# Minimal opt-in API key check: burning Groq/geocoding quota is the main
# risk of leaving this endpoint open. Set SENTINEL_API_KEY in .env to
# require an `X-API-Key` header on every request; leave it unset for local
# dev and this is a no-op. Swap for a real auth scheme before going public.
_SENTINEL_API_KEY = os.getenv("SENTINEL_API_KEY")


@app.middleware("http")
async def require_api_key(request: Request, call_next):
    if _SENTINEL_API_KEY and request.url.path not in ("/", "/docs", "/openapi.json", "/redoc"):
        if request.headers.get("x-api-key") != _SENTINEL_API_KEY:
            raise HTTPException(status_code=401, detail="Missing or invalid X-API-Key header")
    return await call_next(request)


app.include_router(router)


@app.get("/", tags=["Health"])
def health_check():
    """Simple liveness check - confirms the process is up and responding.
    Does NOT check CockroachDB - see /health/deep for that."""
    return {"status": "Sentinel API is running", "docs": "/docs"}


@app.get("/health/deep", tags=["Health"])
def deep_health_check():
    """Readiness check that actually verifies CockroachDB connectivity,
    not just that the process is alive. A "200 OK" from `/` alone doesn't
    tell you memory storage is working - this does. Cheap enough to call
    on every deploy/demo without worrying about cost (one lightweight
    SELECT 1, no embedding model invoked)."""
    from memory import get_conn
    try:
        conn = get_conn()
        try:
            conn.run("SELECT 1")
        finally:
            conn.close()
        return {"status": "healthy", "cockroachdb": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"status": "unhealthy", "cockroachdb": "unreachable", "error": str(e)},
        )


# --- AWS Lambda entrypoint ---
# Only used when deployed behind a Lambda Function URL (Mangum wraps the
# FastAPI ASGI app so Lambda can invoke it like a normal handler). Local
# `uvicorn main:app --reload` never touches this — it's ignored unless
# something imports `main.handler`.
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    # mangum isn't installed in local dev unless you choose to add it —
    # that's fine, it's only required in the Lambda deployment package.
    pass
