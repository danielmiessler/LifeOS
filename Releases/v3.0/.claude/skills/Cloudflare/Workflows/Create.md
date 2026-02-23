# Create Cloudflare Worker or MCP Server

Deploy a new Cloudflare Worker or MCP server.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Create workflow in the Cloudflare skill to deploy a new worker"}' \
  > /dev/null 2>&1 &
```

Running the **Create** workflow in the **Cloudflare** skill to deploy a new worker...

## Project Structure

```
workers/mcp-server-name/
├── src/
│   └── simple.js      # Main worker code
├── wrangler.toml      # Cloudflare config
├── package.json       # Dependencies
└── README.md          # Documentation
```

## Essential wrangler.toml

```toml
name = "mcp-server-name"
main = "src/simple.js"
compatibility_date = "2024-01-01"
account_id = "$CLOUDFLARE_ACCOUNT_ID"

[vars]
MCP_SERVER_NAME = "your-server"
MCP_SERVER_VERSION = "1.0.0"
```

## Deployment

```bash
# CRITICAL: Must unset environment variables that interfere
cd workers/mcp-server-name
(unset CF_API_TOKEN && unset CLOUDFLARE_API_TOKEN && wrangler deploy)
```

## MCP Server Endpoints

- Root `/` - Server info
- `/tools` - List available tools
- `/call` - Execute tools (POST)
- Always include CORS headers
- Return proper JSON responses

## Testing

```bash
# Test root endpoint
curl https://your-server.your-account.workers.dev/

# Test tool execution
curl -X POST https://your-server.your-account.workers.dev/call \
  -H "Content-Type: application/json" \
  -d '{"name": "tool_name", "arguments": {...}}'
```

## Key Details

- **Account ID:** Configure your Cloudflare account ID in wrangler.toml
- **Always unset** CF_API_TOKEN and CLOUDFLARE_API_TOKEN before deploying
- **URL format:** `https://[worker-name].your-account.workers.dev`

## Cloudflare Documentation

For MCP server specifics: https://developers.cloudflare.com/agents/guides/remote-mcp-server/
