#!/usr/bin/env python

import os
import json
from typing import Any, Dict, List
from dataclasses import dataclass
import httpx

import dotenv
from mcp.server.fastmcp import FastMCP

dotenv.load_dotenv()
mcp = FastMCP("Tripadvisor Content API MCP")

@dataclass
class TripadvisorConfig:
    api_key: str
    base_url: str = "https://api.content.tripadvisor.com/api/v1"

config = TripadvisorConfig(
    api_key=os.environ.get("TRIPADVISOR_API_KEY", ""),
)

async def make_api_request(endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Make a request to the Tripadvisor Content API"""
    if not config.api_key:
        raise ValueError("Tripadvisor API key is missing. Please set TRIPADVISOR_API_KEY environment variable.")
    
    url = f"{config.base_url}/{endpoint}"
    headers = {
        "accept": "application/json"
    }

    if params is None:
        params = {}
    params["key"] = config.api_key
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()

@mcp.tool(description="Search for locations (hotels, restaurants, attractions) on Tripadvisor")
async def search_locations(
    searchQuery: str,
    language: str = "en",
    category: str = "",
    phone: str = "",
    address: str = "",
    latLong: str = "",
) -> Dict[str, Any]:
    """
    Search for locations on Tripadvisor.
    
    Parameters:
    - searchQuery: The text to search for
    - language: Language code (default: 'en')
    - category: Optional category filter ('hotels', 'attractions', 'restaurants', 'geos')
    - phone: Optional phone number to search for
    - address: Optional address to search for
    - latLong: Optional latitude,longitude coordinates (e.g., '42.3455,-71.0983')
    """
    params = {
        "searchQuery": searchQuery,
        "language": language,
    }
    
    if category:
        params["category"] = category
    if phone:
        params["phone"] = phone
    if address:
        params["address"] = address
    if latLong:
        params["latLong"] = latLong
    
    return await make_api_request("location/search", params)

@mcp.tool(description="Search for locations near a specific latitude/longitude")
async def search_nearby_locations(
    latitude: float,
    longitude: float,
    language: str = "en",
    category: str = "",
) -> Dict[str, Any]:
    """
    Search for locations near a specific latitude/longitude.
    
    Parameters:
    - latitude: Latitude coordinate
    - longitude: Longitude coordinate
    - language: Language code (default: 'en')
    - category: Optional category filter ('hotels', 'attractions', 'restaurants')
    """
    params = {
        "latLong": f"{latitude},{longitude}",
        "language": language,
    }
    
    if category:
        params["category"] = category
    
    return await make_api_request("location/search", params)

@mcp.tool(description="Get detailed information about a specific location")
async def get_location_details(
    locationId: str,
    language: str = "en",
) -> Dict[str, Any]:
    """
    Get detailed information about a specific location (hotel, restaurant, or attraction).
    
    Parameters:
    - locationId: Tripadvisor location ID (can be string or integer)
    - language: Language code (default: 'en')
    """
    params = {
        "language": language,
    }
    
    # Convert locationId to string to ensure compatibility
    location_id_str = str(locationId)
    
    return await make_api_request(f"location/{location_id_str}/details", params)

@mcp.tool(description="Get reviews for a specific location")
async def get_location_reviews(
    locationId: str,
    language: str = "en",
) -> Dict[str, Any]:
    """
    Get the most recent reviews for a specific location.
    
    Parameters:
    - locationId: Tripadvisor location ID (can be string or integer)
    - language: Language code (default: 'en')
    """
    params = {
        "language": language,
    }
    
    # Convert locationId to string to ensure compatibility
    location_id_str = str(locationId)
    
    return await make_api_request(f"location/{location_id_str}/reviews", params)

@mcp.tool(description="Get photos for a specific location")
async def get_location_photos(
    locationId: str,
    language: str = "en",
) -> Dict[str, Any]:
    """
    Get high-quality photos for a specific location.
    
    Parameters:
    - locationId: Tripadvisor location ID (can be string or integer)
    - language: Language code (default: 'en')
    """
    params = {
        "language": language,
    }
    
    # Convert locationId to string to ensure compatibility
    location_id_str = str(locationId)
    
    return await make_api_request(f"location/{location_id_str}/photos", params)

if __name__ == "__main__":
    print(f"Starting Tripadvisor MCP Server...")
    mcp.run()
