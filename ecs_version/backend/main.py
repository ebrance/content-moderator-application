"""
main.py — FastAPI application for the Content Moderator backend.

Endpoints:
  OPTIONS /api/v1/moderate  — CORS preflight (no auth required)
  GET     /health           — ALB health check (no auth required)
  POST    /api/v1/moderate  — Run content moderation (requires Cognito JWT)

Deployment:
  Run locally:    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
  Run in Docker:  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
"""

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
import logging

from config import get_settings
from auth import get_current_user
from agent import run_moderation

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("content_moderator")

# ── App initialisation ─────────────────────────────────────────────────────────
settings = get_settings()

app = FastAPI(
    title="Content Moderator API",
    description="Super Agent content moderation backend powered by LangGraph + AWS Bedrock",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS middleware ─────────────────────────────────────────────────────────────
# Handles all preflight OPTIONS requests automatically and injects the
# correct Access-Control-* headers on every response.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,   # Set ALLOWED_ORIGINS env var
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Type"],
    max_age=600,   # Cache preflight response for 10 minutes
)


# ── Explicit OPTIONS preflight handler ─────────────────────────────────────────
# FastAPI's CORSMiddleware handles OPTIONS automatically, but this explicit
# handler ensures preflight requests are answered correctly even if the
# middleware is bypassed (e.g. by some ALB configurations).
@app.options("/api/v1/moderate")
async def preflight_moderate(request: Request):
    origin = request.headers.get("origin", "")
    allowed = origin in settings.allowed_origins_list

    return JSONResponse(
        status_code=200,
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin":  origin if allowed else "",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age":       "600",
        },
    )

# ── Request / Response schemas ─────────────────────────────────────────────────

VALID_CONTENT_TYPES = {
    "general_community",
    "kids_platform",
    "marketplace",
    "news_comments",
}


class ModerateRequest(BaseModel):
    content: str = Field(
        ...,
        min_length=1,
        max_length=10_000,
        description="The text content to analyze.",
    )
    content_type: str = Field(
        ...,
        description="Platform context: general_community | kids_platform | marketplace | news_comments",
    )

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        if v not in VALID_CONTENT_TYPES:
            raise ValueError(
                f"Invalid content_type '{v}'. Must be one of: {', '.join(sorted(VALID_CONTENT_TYPES))}"
            )
        return v

    @field_validator("content")
    @classmethod
    def strip_content(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Content cannot be empty or whitespace only.")
        return stripped


class CategoryResult(BaseModel):
    name: str
    status: str    # detected | flagged | clear
    notes: str = ""


class ModerateResponse(BaseModel):
    verdict: str                        # Approved | Flagged | Removed
    agent_used: str
    categories: list[CategoryResult]
    violations: list[str]
    reasoning: str
    processing_time_ms: int
    content_type: str
    error: str | None = None            # Populated when an internal error occurs


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Simple health check used by the ALB target group.
    Returns 200 OK when the service is running.
    """
    return {"status": "ok", "service": "content-moderator-backend"}


@app.post(
    "/api/v1/moderate",
    response_model=ModerateResponse,
    tags=["Moderation"],
    summary="Analyze content for policy violations",
)
async def moderate_content(
    request: ModerateRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Accepts content and a content_type, routes it to the appropriate
    utility agent via the Super Agent LangGraph workflow, and returns
    a structured moderation verdict.

    Requires a valid Cognito ID token in the Authorization header.
    """
    user_email = current_user.get("email", "unknown")
    logger.info(
        "Moderation request from '%s' | content_type=%s | content_length=%d",
        user_email,
        request.content_type,
        len(request.content),
    )

    try:
        result = await run_moderation(
            content=request.content,
            content_type=request.content_type,
        )
    except Exception as exc:
        logger.exception("Unexpected error during moderation: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while analyzing the content.",
        )

    # Log the verdict and surface any internal error
    if result.get("error"):
        logger.error(
            "Agent error in '%s': %s",
            result.get("agent_used"),
            result.get("error"),
        )
    logger.info(
        "Verdict: %s | agent: %s | time: %dms",
        result.get("verdict"),
        result.get("agent_used"),
        result.get("processing_time_ms", 0),
    )

    # If the agent itself recorded an error, surface it as a warning header
    # but still return the best-effort result to the frontend
    categories_raw = result.get("categories") or []
    categories = [
        CategoryResult(
            name=c.get("name", ""),
            status=c.get("status", "clear"),
            notes=c.get("notes", ""),
        )
        for c in categories_raw
    ]

    if result.get("error"):
        logger.error(
            "Agent error in '%s': %s",
            result.get("agent_used"),
            result.get("error"),
        )

    return ModerateResponse(
        verdict=result.get("verdict", "Flagged"),
        agent_used=result.get("agent_used", "unknown"),
        categories=categories,
        violations=result.get("violations") or [],
        reasoning=result.get("reasoning", ""),
        processing_time_ms=result.get("processing_time_ms", 0),
        content_type=request.content_type,
        error=result.get("error"),
    )