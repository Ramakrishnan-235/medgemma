import base64
import json
import logging
from typing import Any
import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("security")

_jwks_cache: dict[str, Any] = {}


async def fetch_jwks(jwks_url: str) -> dict[str, Any]:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(jwks_url)
            if resp.status_code == 200:
                _jwks_cache = resp.json()
                return _jwks_cache
    except Exception as exc:
        logger.warning("Could not reach JWKS URL %s: %s", jwks_url, exc)
    return {}


async def verify_better_auth_jwt(token: str) -> dict[str, Any]:
    """
    Verifies a Better Auth JWT token using JWKS public keys.
    Returns decoded claims containing 'sub' (user_id) and 'workspace_id'.

    Rejects unverified or forged tokens with HTTP 401.
    """
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Cryptographic verification via PyJWT if installed
    try:
        import jwt
        from jwt import PyJWKClient

        try:
            jwks_client = PyJWKClient(settings.JWKS_URL, cache_keys=True)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=settings.JWT_AUDIENCE,
                issuer=settings.JWT_ISSUER,
            )
            _validate_claims(payload)
            return payload
        except Exception as jwks_err:
            logger.warning("JWKS token verification failed: %s", jwks_err)
            # Strictly forbid signature bypass unless explicit developer flag is set
            if getattr(settings, "DEBUG_ALLOW_UNVERIFIED_JWT", False):
                logger.critical(
                    "SECURITY ALERT: Accepting unverified JWT signature because DEBUG_ALLOW_UNVERIFIED_JWT=True. "
                    "Do NOT enable this in production environments!"
                )
                try:
                    unverified = jwt.decode(token, options={"verify_signature": False})
                    _validate_claims(unverified)
                    return unverified
                except Exception as decode_err:
                    logger.error("Unverified JWT decode failed: %s", decode_err)
    except ImportError:
        logger.warning("PyJWT is not installed in current environment.")
        if getattr(settings, "DEBUG_ALLOW_UNVERIFIED_JWT", False):
            logger.critical(
                "SECURITY ALERT: Base64 decoding unverified JWT because DEBUG_ALLOW_UNVERIFIED_JWT=True."
            )
            try:
                parts = token.split(".")
                if len(parts) >= 2:
                    payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
                    payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode("utf-8")))
                    _validate_claims(payload)
                    return payload
            except Exception as e:
                logger.error("Fallback token parsing failed: %s", e)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials: signature verification failed",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _validate_claims(payload: dict[str, Any]) -> None:
    if "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if "workspace_id" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'workspace_id' claim",
            headers={"WWW-Authenticate": "Bearer"},
        )
