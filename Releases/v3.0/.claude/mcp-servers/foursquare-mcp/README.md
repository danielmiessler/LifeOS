# MCP Server enabling access to the Foursquare API

The Foursquare Places API provides detailed location context for apps that need to understand
where a user is and what's around them. Powered by a global, open source database of 100
million places across more than 1500 categories, they convert raw GPS data into meaningful insights.

The GeoTagging API pinpoints exact locations—from coffee shops to parks—with high accuracy
using Foursquare's Place Snap technology, while the Search & Data APIs go beyond basic proximity, 
allowing developers to filter places by category, features, hours, and more. Each result includes 
rich metadata like photos, reviews, ratings, and real-time popularity.

These tools make it possible to build AI Agents that are situationally aware and tailored to 
the user's surroundings for a highly personalized experience.

## What is MCP?

Model Context Protocol is a new standard from Anthropic for connecting AI systems with data sources. 
Read more about it at [Anthropic](https://www.anthropic.com/news/model-context-protocol).

MCP allows you to set up servers that expose functions that an LLM can understand and call directly. 
In this project, we implement an MCP server that can access the Foursquare API in order to support 
local search for places.

## Getting Started

### Foursquare Service API Key

You will need a Foursquare Service API Key to allow your AI agent to access Foursquare API endpoints. 
If you do not already have one, follow the instructions on 
[Foursquare Doc - Manage Your Service API Keys](https://docs.foursquare.com/developer/docs/manage-service-api-keys) 
to create one. 

You will need to log in to your Foursquare developer account or create one if you do not have one 
(creating a basic account is free and includes starter credit for your project). Be sure to copy the 
Service API key upon creation as you will not be able to see it again.

### Download Claude Desktop

Currently MCP is only supported for local use, so you should download the 
[Claude Desktop App](https://claude.ai/download) (remote production MCP servers are still in the works).

### Set up MCP Server

* **Python**: follow the directions in [fsq-server-python/README.md](fsq-server-python/README.md) for instructions on setting up a python based MCP server using uv.
