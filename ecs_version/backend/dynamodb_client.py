"""
dynamodb_client.py — Fetches violation categories from DynamoDB tables.
Each utility agent calls get_violation_categories(table_name) to load
its policy definitions before analyzing content.
"""

import boto3
from functools import lru_cache
from config import get_settings


def _get_table(table_name: str):
    settings = get_settings()
    kwargs = {"region_name": settings.aws_region}
    if settings.dynamodb_endpoint_url:
        kwargs["endpoint_url"] = settings.dynamodb_endpoint_url
    dynamodb = boto3.resource("dynamodb", **kwargs)
    return dynamodb.Table(table_name)


def get_violation_categories(table_name: str) -> list[dict]:
    """
    Scans the given DynamoDB table and returns all violation category
    items as a list of dicts with keys:
      - violation_category (str)
      - description (str)
      - severity_default (str)
      - examples (list[str])
    """
    table = _get_table(table_name)
    response = table.scan()
    items = response.get("Items", [])

    # Handle DynamoDB pagination
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    return items


def format_categories_for_prompt(categories: list[dict]) -> str:
    """Formats violation categories into a readable prompt section."""
    lines = []
    for cat in categories:
        lines.append(f"- **{cat['violation_category']}**: {cat['description']}")
        if cat.get("examples"):
            for ex in cat["examples"][:2]:   # Include up to 2 examples
                lines.append(f"    Example: {ex}")
    return "\n".join(lines)
