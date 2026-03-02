# Query Cloudflare State

Query Cloudflare account state via Code Mode MCP — list workers, check KV data, inspect DNS, view analytics, manage R2/D1/Vectorize.

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Query workflow in the Cloudflare skill to inspect Cloudflare state"}' \
  > /dev/null 2>&1 &
```

Running the **Query** workflow in the **Cloudflare** skill to inspect Cloudflare state...

## When to Use

- "List all my workers"
- "What DNS records does [domain] have?"
- "Check KV namespace contents"
- "Show me my R2 buckets"
- "What's in my D1 database?"
- "Show Vectorize indexes"
- "View worker analytics"
- Any read-only Cloudflare API operation

## How It Works

All queries use Code Mode MCP's two tools:

1. **`search()`** — Find the right API endpoint by keyword
2. **`execute()`** — Call the endpoint

No tokens, no curl, no manual auth. MCP handles everything via OAuth.

## Common Queries

### Workers

```
# List all workers
MCP search("workers scripts list")
MCP execute("GET /accounts/{account_id}/workers/scripts")

# Get worker details
MCP execute("GET /accounts/{account_id}/workers/scripts/{script_name}")

# List worker deployments
MCP execute("GET /accounts/{account_id}/workers/scripts/{script_name}/deployments")

# View worker settings
MCP execute("GET /accounts/{account_id}/workers/scripts/{script_name}/settings")
```

### KV Namespaces

```
# List KV namespaces
MCP search("KV namespaces list")
MCP execute("GET /accounts/{account_id}/storage/kv/namespaces")

# List keys in a namespace
MCP execute("GET /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/keys")

# Read a KV value
MCP execute("GET /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{key_name}")

# Write a KV value
MCP execute("PUT /accounts/{account_id}/storage/kv/namespaces/{namespace_id}/values/{key_name}")
```

### DNS Records

```
# List zones
MCP search("zones list")
MCP execute("GET /zones")

# List DNS records for a zone
MCP execute("GET /zones/{zone_id}/dns_records")

# Get specific record
MCP execute("GET /zones/{zone_id}/dns_records/{record_id}")
```

### R2 Storage

```
# List R2 buckets
MCP search("R2 buckets")
MCP execute("GET /accounts/{account_id}/r2/buckets")

# List objects in a bucket
MCP execute("GET /accounts/{account_id}/r2/buckets/{bucket_name}/objects")
```

### D1 Database

```
# List D1 databases
MCP search("D1 databases")
MCP execute("GET /accounts/{account_id}/d1/database")

# Query a database
MCP execute("POST /accounts/{account_id}/d1/database/{database_id}/query")
```

### Vectorize

```
# List Vectorize indexes
MCP search("vectorize indexes")
MCP execute("GET /accounts/{account_id}/vectorize/v2/indexes")

# Get index details
MCP execute("GET /accounts/{account_id}/vectorize/v2/indexes/{index_name}")
```

### Pages Projects

```
# List Pages projects
MCP search("pages projects")
MCP execute("GET /accounts/{account_id}/pages/projects")

# Get project details
MCP execute("GET /accounts/{account_id}/pages/projects/{project_name}")

# List deployments
MCP execute("GET /accounts/{account_id}/pages/projects/{project_name}/deployments")
```

### Analytics

```
# Worker analytics
MCP search("workers analytics")
MCP execute("GET /accounts/{account_id}/workers/analytics")

# Zone analytics
MCP search("zone analytics")
MCP execute("GET /zones/{zone_id}/analytics/dashboard")
```

## Discovery Pattern

When you don't know the exact endpoint:

1. **Search** for it: `MCP search("what you're looking for")`
2. **Review** the returned endpoints — pick the right one
3. **Execute** with the correct method, path, and parameters

This is the primary advantage of Code Mode MCP — you don't need to memorize 2,500+ endpoints.

## Output

Return query results in a clean, readable format:
- Tables for lists (workers, DNS records, KV keys)
- JSON for detailed objects
- Summary counts when listing large sets
