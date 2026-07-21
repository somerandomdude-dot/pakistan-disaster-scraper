import httpx
import asyncio
import logging
from typing import Optional, Dict, Any, Tuple
from app.core.config import settings
from app.core.exceptions import FetchError
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class ScraperFetcher:
    def __init__(self):
        self.timeout = httpx.Timeout(settings.REQUEST_TIMEOUT_SECONDS)
        self.max_retries = settings.MAX_RETRIES
        
        headers = {
            "User-Agent": settings.SCRAPER_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }
        
        # Optional Proxy support
        proxy = settings.HTTP_PROXY if settings.HTTP_PROXY else None
            
        self.client = httpx.AsyncClient(
            timeout=self.timeout,
            headers=headers,
            follow_redirects=True,
            proxy=proxy,
            verify=False # Some pk government sites might have SSL issues, though False is generally bad practice. Leaving True unless it fails. Wait, let's keep it True, if it fails we can catch it. Actually, I'll set verify=False since gov.pk sites notoriously have expired certificates.
        )

    async def fetch(
        self, 
        url: str, 
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        expected_status: int = 200,
        etag: Optional[str] = None,
        last_modified: Optional[str] = None
    ) -> Tuple[httpx.Response, datetime]:
        """
        Fetch a URL with retries, exponential backoff, and polite polling (ETag/Last-Modified).
        Returns the response and the retrieval timestamp.
        """
        request_headers = {}
        if headers:
            request_headers.update(headers)
            
        if etag:
            request_headers["If-None-Match"] = etag
        if last_modified:
            request_headers["If-Modified-Since"] = last_modified
            
        for attempt in range(1, self.max_retries + 1):
            try:
                retrieved_at = datetime.now(timezone.utc)
                response = await self.client.request(
                    method=method,
                    url=url,
                    headers=request_headers,
                    params=params,
                    data=data,
                    json=json
                )
                
                # If conditional request returns 304 Not Modified, we're good
                if response.status_code == 304:
                    logger.info(f"304 Not Modified for {url}")
                    return response, retrieved_at

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 5))
                    logger.warning(f"Rate limited (429) on {url}. Waiting {retry_after}s.")
                    await asyncio.sleep(retry_after)
                    continue
                
                # For permanent errors (like 404, 401, 403), do not retry unless it's a 5xx
                if 400 <= response.status_code < 500:
                    logger.error(f"Client error {response.status_code} fetching {url}: {response.text[:200]}")
                    response.raise_for_status()
                    
                if response.status_code != expected_status:
                    if attempt < self.max_retries:
                        backoff = 2 ** attempt
                        logger.warning(f"Status {response.status_code} for {url}. Retrying in {backoff}s...")
                        await asyncio.sleep(backoff)
                        continue
                    else:
                        response.raise_for_status()
                        
                return response, retrieved_at
                
            except httpx.HTTPStatusError as e:
                if attempt == self.max_retries:
                    raise FetchError(f"HTTP Error for {url}: {e.response.status_code}") from e
            except (httpx.RequestError, asyncio.TimeoutError) as e:
                if attempt == self.max_retries:
                    raise FetchError(f"Request failed for {url}: {str(e)}") from e
                backoff = 2 ** attempt
                logger.warning(f"Request error for {url}: {str(e)}. Retrying in {backoff}s...")
                await asyncio.sleep(backoff)
                
        raise FetchError(f"Max retries reached for {url}")

    async def close(self):
        await self.client.aclose()
