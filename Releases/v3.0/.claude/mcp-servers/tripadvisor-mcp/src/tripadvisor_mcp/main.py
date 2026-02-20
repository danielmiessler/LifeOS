#!/usr/bin/env python
import sys
import dotenv
from tripadvisor_mcp.server import mcp, config

def setup_environment():
    if dotenv.load_dotenv():
        print("Loaded environment variables from .env file")
    else:
        print("No .env file found or could not load it - using environment variables")

    if not config.api_key:
        print("ERROR: TRIPADVISOR_API_KEY environment variable is not set")
        print("Please set it to your Tripadvisor Content API key")
        return False
    
    print(f"Tripadvisor Content API configuration:")
    print(f"  API Key: {'*' * (len(config.api_key) - 8) + config.api_key[-8:] if config.api_key else 'Not set'}")
    print(f"  Base URL: {config.base_url}")
    
    return True

def run_server():
    """Main entry point for the Tripadvisor MCP Server"""
    # Setup environment
    if not setup_environment():
        sys.exit(1)
    
    print("\nStarting Tripadvisor MCP Server...")
    print("Running server in standard mode...")
    
    # Run the server with the stdio transport
    mcp.run(transport="stdio")

if __name__ == "__main__":
    run_server()
