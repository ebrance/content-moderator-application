"""
auth.py — Validates AWS Cognito JWT tokens on incoming requests.

The frontend sends the Cognito ID token in the Authorization header:
    Authorization: Bearer <id_token>

This module fetches the Cognito JWKS and validates the token's
signature, expiry, issuer, and client ID manually — bypassing
python-jose's built-in audience check which fails on Access tokens
because they use `client_id` instead of `aud` for the client ID claim.
"""

import httpx
from functools import lru_cache
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, ExpiredSignatureError

from config import get_settings

security = HTTPBearer()


@lru_cache(maxsize=1)
def _get_jwks(user_pool_id: str, region: str) -> dict:
    """Fetch and cache the JWKS public keys from Cognito."""
    url = (
        f"https://cognito-idp.{region}.amazonaws.com/"
        f"{user_pool_id}/.well-known/jwks.json"
    )
    response = httpx.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    FastAPI dependency — validates the Bearer token and returns the
    decoded claims dict. Raises HTTP 401 if invalid.

    Supports both Cognito ID tokens and Access tokens:
      - ID token:     token_use = "id",     client verified via `aud` claim
      - Access token: token_use = "access", client verified via `client_id` claim
    """
    settings = get_settings()
    token = credentials.credentials

    try:
        jwks = _get_jwks(settings.cognito_user_pool_id, settings.cognito_region)

        # Decode header to get the key ID (kid)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        # Find the matching RSA public key
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key["kid"] == kid:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n":   key["n"],
                    "e":   key["e"],
                }
                break

        if not rsa_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find a matching public key for this token.",
            )

        issuer = (
            f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/"
            f"{settings.cognito_user_pool_id}"
        )

        # Decode and verify signature + issuer + expiry.
        # Audience verification is disabled here because:
        #   - ID tokens store the client ID in `aud`
        #   - Access tokens store it in `client_id` (no `aud` claim)
        # We verify the client ID manually below instead.
        claims = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"verify_aud": False},
        )

        # Manually verify the token belongs to our Cognito App Client
        token_use = claims.get("token_use")

        if token_use == "id":
            # ID token — `aud` claim contains the App Client ID
            if claims.get("aud") != settings.cognito_client_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token audience does not match the expected App Client ID.",
                )

        elif token_use == "access":
            # Access token — `client_id` claim contains the App Client ID
            if claims.get("client_id") != settings.cognito_client_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token client_id does not match the expected App Client ID.",
                )

        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    f"Unrecognised token_use claim: '{token_use}'. "
                    "Expected 'id' or 'access'."
                ),
            )

        return claims

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
        )
    except HTTPException:
        raise
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )