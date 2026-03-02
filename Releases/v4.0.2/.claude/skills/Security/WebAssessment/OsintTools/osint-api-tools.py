#!/usr/bin/env python3
"""
OSINT API Tools - Unified interface for paid OSINT services

This module provides a unified interface for interacting with premium OSINT services:
- Shodan: IoT/device search and network reconnaissance
- Dehashed: Credential breach monitoring and analysis
- OSINT Industries: Comprehensive OSINT data aggregation

Usage:
    from osint_api_tools import ShodanClient, DehashedClient, OSINTIndustriesClient

    # Initialize clients
    shodan = ShodanClient()
    dehashed = DehashedClient()
    osint_ind = OSINTIndustriesClient()

    # Perform searches
    results = shodan.search("apache")
    breaches = dehashed.search_email("example@domain.com")
    profile = osint_ind.search_username("target_user")

Requirements:
    pip install shodan requests python-dotenv

Environment Variables (add to ${PAI_DIR}/.env):
    SHODAN_API_KEY=your_key_here
    DEHASHED_API_KEY=your_key_here
    DEHASHED_EMAIL=your_email_here
    OSINT_INDUSTRIES_API_KEY=your_key_here
"""

import os
import sys
import json
import argparse
from typing import Dict, List, Optional, Union, Tuple
from dataclasses import dataclass
from enum import Enum

# Try to import optional dependencies
try:
    import shodan
    SHODAN_AVAILABLE = True
except ImportError:
    SHODAN_AVAILABLE = False
    print("Warning: 'shodan' package not installed. Run: pip install shodan", file=sys.stderr)

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("Warning: 'requests' package not installed. Run: pip install requests", file=sys.stderr)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.expanduser(os.environ.get("PAI_DIR", "~/.claude") + "/.env"))
except ImportError:
    print("Warning: 'python-dotenv' not installed. Falling back to os.environ", file=sys.stderr)


# ============================================================================
# Error Classes (TypeScript-style error handling)
# ============================================================================

class OSINTError(Exception):
    """Base exception for OSINT API errors"""
    def __init__(self, message: str, service: str, error_code: Optional[str] = None):
        self.message = message
        self.service = service
        self.error_code = error_code
        super().__init__(self.message)

    def to_dict(self) -> Dict:
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "service": self.service,
            "error_code": self.error_code
        }


class APIKeyMissingError(OSINTError):
    """Raised when API key is not configured"""
    pass


class APIKeyInvalidError(OSINTError):
    """Raised when API key is invalid or expired"""
    pass


class RateLimitError(OSINTError):
    """Raised when API rate limit is exceeded"""
    pass


class ServiceUnavailableError(OSINTError):
    """Raised when API service is unavailable"""
    pass


# ============================================================================
# Result Data Classes
# ============================================================================

@dataclass
class APIResult:
    """Base class for API results"""
    success: bool
    service: str
    data: Optional[Dict] = None
    error: Optional[Dict] = None

    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "service": self.service,
            "data": self.data,
            "error": self.error
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)


# ============================================================================
# Shodan Client
# ============================================================================

class ShodanClient:
    """
    Shodan API client for IoT/device search and network reconnaissance.

    Shodan is a search engine for Internet-connected devices. It allows you to:
    - Search for exposed services and devices
    - Identify vulnerable systems
    - Map network attack surfaces
    - Research IoT security posture

    Example:
        >>> client = ShodanClient()
        >>> result = client.search("apache country:US", max_results=10)
        >>> if result.success:
        ...     for match in result.data['matches']:
        ...         print(f"{match['ip_str']}:{match['port']}")

    Rate Limits:
        - Free: 1 query/second
        - Freelancer: Unlimited queries
        - Small Business: Unlimited queries
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Shodan client.

        Args:
            api_key: Shodan API key. If None, reads from SHODAN_API_KEY env var.

        Raises:
            APIKeyMissingError: If no API key is provided or found in environment.
        """
        self.api_key = api_key or os.getenv("SHODAN_API_KEY")

        if not self.api_key:
            raise APIKeyMissingError(
                "Shodan API key not found. Set SHODAN_API_KEY in ${PAI_DIR}/.env",
                service="Shodan"
            )

        if not SHODAN_AVAILABLE:
            raise ImportError("shodan package not installed. Run: pip install shodan")

        self.api = shodan.Shodan(self.api_key)

    def search(self, query: str, max_results: int = 100) -> APIResult:
        """
        Search Shodan for devices matching query.

        Args:
            query: Shodan search query (e.g., "apache", "port:22", "country:US")
            max_results: Maximum number of results to return

        Returns:
            APIResult with matches in data['matches']

        Example:
            >>> result = client.search("nginx")
            >>> print(f"Found {result.data['total']} results")
        """
        try:
            results = self.api.search(query, limit=max_results)

            return APIResult(
                success=True,
                service="Shodan",
                data={
                    "query": query,
                    "total": results['total'],
                    "matches": results['matches']
                }
            )

        except shodan.APIError as e:
            error_msg = str(e)

            if "Invalid API key" in error_msg:
                raise APIKeyInvalidError(error_msg, service="Shodan")
            elif "Rate limit" in error_msg:
                raise RateLimitError(error_msg, service="Shodan")
            else:
                return APIResult(
                    success=False,
                    service="Shodan",
                    error={"message": error_msg, "type": "APIError"}
                )

    def host(self, ip: str) -> APIResult:
        """
        Get detailed information about a specific host.

        Args:
            ip: IP address to look up

        Returns:
            APIResult with host information in data

        Example:
            >>> result = client.host("8.8.8.8")
            >>> print(result.data['org'])
        """
        try:
            host_info = self.api.host(ip)

            return APIResult(
                success=True,
                service="Shodan",
                data=host_info
            )

        except shodan.APIError as e:
            return APIResult(
                success=False,
                service="Shodan",
                error={"message": str(e), "type": "APIError"}
            )

    def test_connection(self) -> APIResult:
        """Test API key validity."""
        try:
            info = self.api.info()
            return APIResult(
                success=True,
                service="Shodan",
                data={"account_info": info}
            )
        except shodan.APIError as e:
            return APIResult(
                success=False,
                service="Shodan",
                error={"message": str(e)}
            )


# ============================================================================
# Dehashed Client
# ============================================================================

class DehashedClient:
    """
    Dehashed API client for credential breach monitoring.

    Dehashed is a search engine for leaked credentials and breach data. It allows you to:
    - Monitor for compromised credentials
    - Search breach databases
    - Identify password exposures
    - Assess account security posture

    Example:
        >>> client = DehashedClient()
        >>> result = client.search_email("user@example.com")
        >>> if result.success:
        ...     print(f"Found {len(result.data['entries'])} breaches")

    Rate Limits:
        - Varies by subscription tier
        - Typically 1-10 queries/second
    """

    BASE_URL = "https://api.dehashed.com/search"

    def __init__(self, api_key: Optional[str] = None, email: Optional[str] = None):
        """
        Initialize Dehashed client.

        Args:
            api_key: Dehashed API key. If None, reads from DEHASHED_API_KEY env var.
            email: Dehashed account email. If None, reads from DEHASHED_EMAIL env var.

        Raises:
            APIKeyMissingError: If no API key or email is provided.
        """
        self.api_key = api_key or os.getenv("DEHASHED_API_KEY")
        self.email = email or os.getenv("DEHASHED_EMAIL")

        if not self.api_key:
            raise APIKeyMissingError(
                "Dehashed API key not found. Set DEHASHED_API_KEY in ${PAI_DIR}/.env",
                service="Dehashed"
            )

        if not self.email:
            raise APIKeyMissingError(
                "Dehashed email not found. Set DEHASHED_EMAIL in ${PAI_DIR}/.env",
                service="Dehashed"
            )

        if not REQUESTS_AVAILABLE:
            raise ImportError("requests package not installed. Run: pip install requests")

        self.session = requests.Session()
        self.session.auth = (self.email, self.api_key)
        self.session.headers.update({"Accept": "application/json"})

    def search(self, query: str, size: int = 100) -> APIResult:
        """
        Search Dehashed database.

        Args:
            query: Search query (supports fields: email, username, password, domain, etc.)
            size: Number of results to return (max 10,000)

        Returns:
            APIResult with breach entries in data['entries']

        Example:
            >>> result = client.search("email:user@example.com")
        """
        try:
            params = {"query": query, "size": size}
            response = self.session.get(self.BASE_URL, params=params, timeout=30)

            if response.status_code == 401:
                raise APIKeyInvalidError(
                    "Invalid Dehashed credentials",
                    service="Dehashed",
                    error_code="401"
                )
            elif response.status_code == 429:
                raise RateLimitError(
                    "Dehashed rate limit exceeded",
                    service="Dehashed",
                    error_code="429"
                )

            response.raise_for_status()
            data = response.json()

            return APIResult(
                success=True,
                service="Dehashed",
                data={
                    "query": query,
                    "total": data.get("total", 0),
                    "entries": data.get("entries", [])
                }
            )

        except requests.RequestException as e:
            return APIResult(
                success=False,
                service="Dehashed",
                error={"message": str(e), "type": "RequestError"}
            )

    def search_email(self, email: str) -> APIResult:
        """
        Search for breaches containing specific email address.

        Args:
            email: Email address to search for

        Returns:
            APIResult with breach entries
        """
        return self.search(f"email:{email}")

    def search_username(self, username: str) -> APIResult:
        """
        Search for breaches containing specific username.

        Args:
            username: Username to search for

        Returns:
            APIResult with breach entries
        """
        return self.search(f"username:{username}")

    def search_domain(self, domain: str) -> APIResult:
        """
        Search for breaches from specific domain.

        Args:
            domain: Domain to search for (e.g., "example.com")

        Returns:
            APIResult with breach entries
        """
        return self.search(f"domain:{domain}")

    def test_connection(self) -> APIResult:
        """Test API key validity."""
        try:
            response = self.session.get(self.BASE_URL, params={"query": "test", "size": 1}, timeout=10)

            if response.status_code == 401:
                return APIResult(
                    success=False,
                    service="Dehashed",
                    error={"message": "Invalid credentials"}
                )

            return APIResult(
                success=True,
                service="Dehashed",
                data={"message": "Connection successful"}
            )

        except requests.RequestException as e:
            return APIResult(
                success=False,
                service="Dehashed",
                error={"message": str(e)}
            )


# ============================================================================
# OSINT Industries Client
# ============================================================================

class OSINTIndustriesClient:
    """
    OSINT Industries API client for comprehensive OSINT data aggregation.

    OSINT Industries provides unified access to multiple OSINT data sources including:
    - Social media profiles
    - Domain registration data
    - Email correlation
    - Username enumeration
    - Breach data aggregation

    Example:
        >>> client = OSINTIndustriesClient()
        >>> result = client.search_email("user@example.com")
        >>> if result.success:
        ...     print(result.data)

    Rate Limits:
        - Free tier: Limited queries per day
        - Paid tiers: Higher rate limits based on subscription
    """

    BASE_URL = "https://api.osint.industries/v1"

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize OSINT Industries client.

        Args:
            api_key: OSINT Industries API key. If None, reads from OSINT_INDUSTRIES_API_KEY env var.

        Raises:
            APIKeyMissingError: If no API key is provided.
        """
        self.api_key = api_key or os.getenv("OSINT_INDUSTRIES_API_KEY")

        if not self.api_key:
            raise APIKeyMissingError(
                "OSINT Industries API key not found. Set OSINT_INDUSTRIES_API_KEY in ${PAI_DIR}/.env",
                service="OSINT Industries"
            )

        if not REQUESTS_AVAILABLE:
            raise ImportError("requests package not installed. Run: pip install requests")

        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        })

    def search(self, query_type: str, query_value: str) -> APIResult:
        """
        Generic search across OSINT Industries data sources.

        Args:
            query_type: Type of query (email, username, domain, phone, etc.)
            query_value: Value to search for

        Returns:
            APIResult with search results in data

        Example:
            >>> result = client.search("email", "user@example.com")
        """
        try:
            url = f"{self.BASE_URL}/search"
            payload = {"type": query_type, "query": query_value}

            response = self.session.post(url, json=payload, timeout=30)

            if response.status_code == 401:
                raise APIKeyInvalidError(
                    "Invalid OSINT Industries API key",
                    service="OSINT Industries",
                    error_code="401"
                )
            elif response.status_code == 429:
                raise RateLimitError(
                    "OSINT Industries rate limit exceeded",
                    service="OSINT Industries",
                    error_code="429"
                )

            response.raise_for_status()
            data = response.json()

            return APIResult(
                success=True,
                service="OSINT Industries",
                data={
                    "query_type": query_type,
                    "query_value": query_value,
                    "results": data
                }
            )

        except requests.RequestException as e:
            return APIResult(
                success=False,
                service="OSINT Industries",
                error={"message": str(e), "type": "RequestError"}
            )

    def search_email(self, email: str) -> APIResult:
        """Search for data associated with email address."""
        return self.search("email", email)

    def search_username(self, username: str) -> APIResult:
        """Search for data associated with username."""
        return self.search("username", username)

    def search_domain(self, domain: str) -> APIResult:
        """Search for data associated with domain."""
        return self.search("domain", domain)

    def search_phone(self, phone: str) -> APIResult:
        """Search for data associated with phone number."""
        return self.search("phone", phone)

    def test_connection(self) -> APIResult:
        """Test API key validity."""
        try:
            # Simple health check or minimal query
            url = f"{self.BASE_URL}/health"
            response = self.session.get(url, timeout=10)

            if response.status_code == 401:
                return APIResult(
                    success=False,
                    service="OSINT Industries",
                    error={"message": "Invalid API key"}
                )

            return APIResult(
                success=True,
                service="OSINT Industries",
                data={"message": "Connection successful"}
            )

        except requests.RequestException as e:
            return APIResult(
                success=False,
                service="OSINT Industries",
                error={"message": str(e)}
            )


# ============================================================================
# CLI Interface
# ============================================================================

def main():
    """CLI interface for OSINT API tools."""
    parser = argparse.ArgumentParser(
        description="OSINT API Tools - Unified interface for paid OSINT services",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test all API connections
  python3 osint-api-tools.py --test

  # Search Shodan for Apache servers
  python3 osint-api-tools.py --shodan "apache"

  # Search Dehashed for email
  python3 osint-api-tools.py --dehashed-email "user@example.com"

  # Search OSINT Industries for username
  python3 osint-api-tools.py --osint-username "target_user"
        """
    )

    parser.add_argument("--test", action="store_true", help="Test all API connections")
    parser.add_argument("--shodan", metavar="QUERY", help="Search Shodan")
    parser.add_argument("--shodan-host", metavar="IP", help="Get Shodan host info")
    parser.add_argument("--dehashed", metavar="QUERY", help="Search Dehashed")
    parser.add_argument("--dehashed-email", metavar="EMAIL", help="Search Dehashed by email")
    parser.add_argument("--dehashed-username", metavar="USERNAME", help="Search Dehashed by username")
    parser.add_argument("--osint-email", metavar="EMAIL", help="Search OSINT Industries by email")
    parser.add_argument("--osint-username", metavar="USERNAME", help="Search OSINT Industries by username")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")

    args = parser.parse_args()

    # Test connections
    if args.test:
        print("Testing OSINT API connections...\n")

        # Test Shodan
        try:
            shodan_client = ShodanClient()
            result = shodan_client.test_connection()
            status = "✓ PASS" if result.success else "✗ FAIL"
            print(f"Shodan: {status}")
            if not result.success:
                print(f"  Error: {result.error['message']}")
        except (APIKeyMissingError, ImportError) as e:
            print(f"Shodan: ✗ SKIP - {str(e)}")

        # Test Dehashed
        try:
            dehashed_client = DehashedClient()
            result = dehashed_client.test_connection()
            status = "✓ PASS" if result.success else "✗ FAIL"
            print(f"Dehashed: {status}")
            if not result.success:
                print(f"  Error: {result.error['message']}")
        except (APIKeyMissingError, ImportError) as e:
            print(f"Dehashed: ✗ SKIP - {str(e)}")

        # Test OSINT Industries
        try:
            osint_client = OSINTIndustriesClient()
            result = osint_client.test_connection()
            status = "✓ PASS" if result.success else "✗ FAIL"
            print(f"OSINT Industries: {status}")
            if not result.success:
                print(f"  Error: {result.error['message']}")
        except (APIKeyMissingError, ImportError) as e:
            print(f"OSINT Industries: ✗ SKIP - {str(e)}")

        return

    # Execute specific queries
    result = None

    if args.shodan:
        client = ShodanClient()
        result = client.search(args.shodan)

    elif args.shodan_host:
        client = ShodanClient()
        result = client.host(args.shodan_host)

    elif args.dehashed:
        client = DehashedClient()
        result = client.search(args.dehashed)

    elif args.dehashed_email:
        client = DehashedClient()
        result = client.search_email(args.dehashed_email)

    elif args.dehashed_username:
        client = DehashedClient()
        result = client.search_username(args.dehashed_username)

    elif args.osint_email:
        client = OSINTIndustriesClient()
        result = client.search_email(args.osint_email)

    elif args.osint_username:
        client = OSINTIndustriesClient()
        result = client.search_username(args.osint_username)

    else:
        parser.print_help()
        return

    # Output results
    if result:
        if args.json:
            print(result.to_json())
        else:
            if result.success:
                print(f"✓ Success - {result.service}")
                print(json.dumps(result.data, indent=2))
            else:
                print(f"✗ Error - {result.service}")
                print(json.dumps(result.error, indent=2))


if __name__ == "__main__":
    main()
