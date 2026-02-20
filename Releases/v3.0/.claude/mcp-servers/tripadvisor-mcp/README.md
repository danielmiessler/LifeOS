# Tripadvisor MCP Server

A [Model Context Protocol][mcp] (MCP) server for Tripadvisor Content API.

This provides access to Tripadvisor location data, reviews, and photos through standardized MCP interfaces, allowing AI assistants to search for travel destinations and experiences.

[mcp]: https://modelcontextprotocol.io

## Features

- [x] Search for locations (hotels, restaurants, attractions) on Tripadvisor
- [x] Get detailed information about specific locations
- [x] Retrieve reviews and photos for locations
- [x] Search for nearby locations based on coordinates
- [x] API Key authentication
- [x] Docker containerization support

- [x] Provide interactive tools for AI assistants

The list of tools is configurable, so you can choose which tools you want to make available to the MCP client.

## Usage

1. Get your Tripadvisor Content API key from the [Tripadvisor Developer Portal](https://developer.tripadvisor.com/).

2. Configure the environment variables for your Tripadvisor Content API, either through a `.env` file or system environment variables:

```env
# Required: Tripadvisor Content API configuration
TRIPADVISOR_API_KEY=your_api_key_here
```

3. Add the server configuration to your client configuration file. For example, for Claude Desktop:

```json
{
  "mcpServers": {
    "tripadvisor": {
      "command": "uv",
      "args": [
        "--directory",
        "<full path to tripadvisor-mcp directory>",
        "run",
        "src/tripadvisor_mcp/main.py"
      ],
      "env": {
        "TRIPADVISOR_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

> Note: if you see `Error: spawn uv ENOENT` in Claude Desktop, you may need to specify the full path to `uv` or set the environment variable `NO_UV=1` in the configuration.

## Docker Usage

This project includes Docker support for easy deployment and isolation.

### Building the Docker Image

Build the Docker image using:

```bash
docker build -t tripadvisor-mcp-server .
```

### Running with Docker

You can run the server using Docker in several ways:

#### Using docker run directly:

```bash
docker run -it --rm \
  -e TRIPADVISOR_API_KEY=your_api_key_here \
  tripadvisor-mcp-server
```

#### Using docker-compose:

Create a `.env` file with your Tripadvisor API key and then run:

```bash
docker-compose up
```

### Running with Docker in Claude Desktop

To use the containerized server with Claude Desktop, update the configuration to use Docker with the environment variables:

```json
{
  "mcpServers": {
    "tripadvisor": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e", "TRIPADVISOR_API_KEY",
        "tripadvisor-mcp-server"
      ],
      "env": {
        "TRIPADVISOR_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

This configuration passes the environment variables from Claude Desktop to the Docker container by using the `-e` flag with just the variable name, and providing the actual values in the `env` object.

## Development

Contributions are welcome! Please open an issue or submit a pull request if you have any suggestions or improvements.

This project uses [`uv`](https://github.com/astral-sh/uv) to manage dependencies. Install `uv` following the instructions for your platform:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

You can then create a virtual environment and install the dependencies with:

```bash
uv venv
source .venv/bin/activate  # On Unix/macOS
.venv\Scripts\activate     # On Windows
uv pip install -e .
```

## Project Structure

The project has been organized with a `src` directory structure:

```
tripadvisor-mcp/
├── src/
│   └── tripadvisor_mcp/
│       ├── __init__.py      # Package initialization
│       ├── server.py        # MCP server implementation
│       ├── main.py          # Main application logic
├── Dockerfile               # Docker configuration
├── docker-compose.yml       # Docker Compose configuration
├── .dockerignore            # Docker ignore file
├── pyproject.toml           # Project configuration
└── README.md                # This file
```

### Testing

The project includes a test suite that ensures functionality and helps prevent regressions.

Run the tests with pytest:

```bash
# Install development dependencies
uv pip install -e ".[dev]"

# Run the tests
pytest

# Run with coverage report
pytest --cov=src --cov-report=term-missing
```

### Tools

| Tool | Category | Description |
| --- | --- | --- |
| `search_locations` | Search | Search for locations by query text, category, and other filters |
| `search_nearby_locations` | Search | Find locations near specific coordinates |
| `get_location_details` | Retrieval | Get detailed information about a location |
| `get_location_reviews` | Retrieval | Retrieve reviews for a location |
| `get_location_photos` | Retrieval | Get photos for a location |

## License

MIT

---

[mcp]: https://modelcontextprotocol.io
