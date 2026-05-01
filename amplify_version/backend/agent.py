"""
agent.py — Content Moderation Super Agent using LangGraph.

Architecture:
  SuperAgent (router)
      ├── general_community_agent  → DynamoDB: general-community
      ├── kids_platform_agent      → DynamoDB: kids-platform
      ├── marketplace_agent        → DynamoDB: marketplace
      └── news_comments_agent      → DynamoDB: news-comments

Flow:
  1. The SuperAgent inspects the content_type field and routes to
     the appropriate utility agent node.
  2. The utility agent fetches its violation categories from DynamoDB,
     builds a structured prompt, calls AWS Bedrock (Claude 3), and
     parses the verdict.
  3. The result is returned to the FastAPI layer.
"""

import json
import time
import re
from typing import TypedDict, Literal, Optional

import boto3
from langgraph.graph import StateGraph, END

from config import get_settings
from dynamodb_client import get_violation_categories, format_categories_for_prompt


# ── State schema ──────────────────────────────────────────────────────────────

class ModerationState(TypedDict):
    # Inputs
    content: str
    content_type: str                  # general_community | kids_platform | marketplace | news_comments

    # Routing
    agent_used: Optional[str]

    # Outputs
    verdict: Optional[str]             # Approved | Flagged | Removed
    categories: Optional[list[dict]]   # [{name, status}, ...]
    violations: Optional[list[str]]    # Specific violation descriptions
    reasoning: Optional[str]           # Human-readable summary
    processing_time_ms: Optional[int]
    error: Optional[str]


# ── Bedrock client (boto3 directly — avoids LangChain model prefix issues) ────

def _invoke_bedrock(system_prompt: str, user_prompt: str) -> str:
    """
    Calls the Bedrock Converse API directly via boto3.
    Works correctly with regional inference profile IDs (us. / eu. / ap. prefix).
    """
    settings = get_settings()
    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)

    response = client.converse(
        modelId=settings.bedrock_model_id,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        inferenceConfig={
            "maxTokens": 1024,
            "temperature": 0.0,
        },
    )
    return response["output"]["message"]["content"][0]["text"]


# ── Prompt builder ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a precise content moderation utility agent.
Your only task is to analyze the provided content against the listed violation categories
and return a structured JSON verdict. You must be objective, consistent, and thorough.

VERDICT DEFINITIONS:
- "Approved"  — Content is clean. No violations detected. Safe to publish.
- "Flagged"   — Content contains moderate violations or borderline issues requiring human review.
- "Removed"   — Content contains clear, serious violations that must be removed immediately.

VERDICT ESCALATION RULE:
If ANY single category result is "Removed", the overall verdict must be "Removed".
If no "Removed" but ANY category is "Flagged", the overall verdict must be "Flagged".
Only if ALL categories are "Clear" should the overall verdict be "Approved".

RESPONSE FORMAT:
Respond ONLY with a valid JSON object. No preamble, no markdown fences.
{
  "verdict": "Approved" | "Flagged" | "Removed",
  "categories": [
    {
      "name": "<violation category name>",
      "status": "detected" | "flagged" | "clear",
      "notes": "<brief one-sentence reason>"
    }
  ],
  "violations": ["<specific violation description>", ...],
  "reasoning": "<2-3 sentence plain-language summary explaining the overall verdict>"
}

The "violations" list should be empty if verdict is Approved.
Each "notes" field in categories should be concise (one sentence max).
"""


def _build_user_prompt(content: str, categories: list[dict]) -> str:
    categories_text = format_categories_for_prompt(categories)
    return f"""VIOLATION CATEGORIES FOR THIS PLATFORM:
{categories_text}

CONTENT TO ANALYZE:
\"\"\"
{content}
\"\"\"

Analyze the content against each violation category above and return your JSON verdict."""


# ── Generic utility agent executor ────────────────────────────────────────────

def _run_utility_agent(
    state: ModerationState,
    table_name: str,
    agent_name: str,
) -> ModerationState:
    """
    Fetches violation categories from DynamoDB, calls Bedrock,
    and parses the structured verdict. Shared by all four utility agents.
    """
    start_ms = int(time.time() * 1000)

    try:
        # 1. Fetch violation categories from DynamoDB
        categories = get_violation_categories(table_name)
        if not categories:
            return {
                **state,
                "agent_used": agent_name,
                "verdict": "Flagged",
                "reasoning": f"No violation categories found in table '{table_name}'. Manual review required.",
                "categories": [],
                "violations": [],
                "processing_time_ms": int(time.time() * 1000) - start_ms,
            }

        # 2. Build prompt and call Bedrock directly via boto3
        raw_text = _invoke_bedrock(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=_build_user_prompt(state["content"], categories),
        ).strip()

        # 3. Parse JSON response (strip markdown fences if present)
        json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if not json_match:
            raise ValueError(f"No JSON found in LLM response: {raw_text[:200]}")
        parsed = json.loads(json_match.group())

        return {
            **state,
            "agent_used": agent_name,
            "verdict": parsed.get("verdict", "Flagged"),
            "categories": parsed.get("categories", []),
            "violations": parsed.get("violations", []),
            "reasoning": parsed.get("reasoning", ""),
            "processing_time_ms": int(time.time() * 1000) - start_ms,
            "error": None,
        }

    except json.JSONDecodeError as e:
        return {
            **state,
            "agent_used": agent_name,
            "verdict": "Flagged",
            "reasoning": "Content analysis encountered a parsing error. Manual review required.",
            "categories": [],
            "violations": [],
            "processing_time_ms": int(time.time() * 1000) - start_ms,
            "error": f"JSON parse error: {str(e)}",
        }
    except Exception as e:
        return {
            **state,
            "agent_used": agent_name,
            "verdict": "Flagged",
            "reasoning": "Content analysis failed due to an internal error. Manual review required.",
            "categories": [],
            "violations": [],
            "processing_time_ms": int(time.time() * 1000) - start_ms,
            "error": str(e),
        }


# ── Four utility agent nodes ───────────────────────────────────────────────────

def general_community_agent(state: ModerationState) -> ModerationState:
    return _run_utility_agent(state, "general-community", "general_community_agent")


def kids_platform_agent(state: ModerationState) -> ModerationState:
    return _run_utility_agent(state, "kids-platform", "kids_platform_agent")


def marketplace_agent(state: ModerationState) -> ModerationState:
    return _run_utility_agent(state, "marketplace", "marketplace_agent")


def news_comments_agent(state: ModerationState) -> ModerationState:
    return _run_utility_agent(state, "news-comments", "news_comments_agent")


# ── Super Agent router ────────────────────────────────────────────────────────

CONTENT_TYPE_TO_NODE: dict[str, str] = {
    "general_community": "general_community_agent",
    "kids_platform":     "kids_platform_agent",
    "marketplace":       "marketplace_agent",
    "news_comments":     "news_comments_agent",
}


def route_content(
    state: ModerationState,
) -> Literal[
    "general_community_agent",
    "kids_platform_agent",
    "marketplace_agent",
    "news_comments_agent",
]:
    """
    Super Agent routing logic.
    Maps content_type → utility agent node name.
    Defaults to general_community_agent if unrecognized.
    """
    content_type = state.get("content_type", "general_community")
    return CONTENT_TYPE_TO_NODE.get(content_type, "general_community_agent")


# ── Build the LangGraph workflow ───────────────────────────────────────────────

def build_moderation_graph() -> StateGraph:
    """
    Constructs and compiles the LangGraph state machine.

    Graph topology:
      START
        └─► [super_agent_router] ──conditional──►
              ├── general_community_agent ──► END
              ├── kids_platform_agent     ──► END
              ├── marketplace_agent       ──► END
              └── news_comments_agent     ──► END
    """
    graph = StateGraph(ModerationState)

    # Register utility agent nodes
    graph.add_node("general_community_agent", general_community_agent)
    graph.add_node("kids_platform_agent",     kids_platform_agent)
    graph.add_node("marketplace_agent",       marketplace_agent)
    graph.add_node("news_comments_agent",     news_comments_agent)

    # Super Agent — conditional entry point routing to the correct utility agent
    graph.set_conditional_entry_point(
        route_content,
        {
            "general_community_agent": "general_community_agent",
            "kids_platform_agent":     "kids_platform_agent",
            "marketplace_agent":       "marketplace_agent",
            "news_comments_agent":     "news_comments_agent",
        },
    )

    # All utility agents lead to END
    graph.add_edge("general_community_agent", END)
    graph.add_edge("kids_platform_agent",     END)
    graph.add_edge("marketplace_agent",       END)
    graph.add_edge("news_comments_agent",     END)

    return graph.compile()


# Compiled graph — import and reuse this singleton in main.py
moderation_graph = build_moderation_graph()


# ── Public API ─────────────────────────────────────────────────────────────────

async def run_moderation(content: str, content_type: str) -> dict:
    """
    Entry point called by the FastAPI route handler.
    Returns the final ModerationState as a dict.
    """
    initial_state: ModerationState = {
        "content":          content,
        "content_type":     content_type,
        "agent_used":       None,
        "verdict":          None,
        "categories":       None,
        "violations":       None,
        "reasoning":        None,
        "processing_time_ms": None,
        "error":            None,
    }
    result = await moderation_graph.ainvoke(initial_state)
    return result