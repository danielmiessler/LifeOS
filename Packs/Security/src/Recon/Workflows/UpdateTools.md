# Update Tools Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the UpdateTools workflow in the Recon skill to update recon tools"}' \
  > /dev/null 2>&1 &
```

Running the **UpdateTools** workflow in the **Recon** skill to update recon tools...

Updates all Project Discovery reconnaissance tools using pdtm.

## Trigger Phrases
- "update recon tools"
- "update project discovery tools"
- "update pdtm tools"
- "upgrade recon tooling"

## Execution

```bash
# Update pdtm itself first
pdtm -self-update

# Update all tools to latest versions
pdtm -update-all

# List installed tools and versions
pdtm -list
```

## Installed Tools

Project Discovery tools managed by pdtm:

| Tool | Purpose |
|------|---------|
| subfinder | Subdomain enumeration |
| httpx | HTTP probing and tech detection |
| nuclei | Vulnerability scanning |
| naabu | Port scanning |
| dnsx | DNS toolkit |
| chaos-client | Chaos subdomain database |
| katana | Web crawling |
| tlsx | TLS/SSL analysis |
| cdncheck | CDN detection |
| asnmap | ASN mapping |
| mapcidr | CIDR manipulation |
| uncover | Search engine dorking |
| alterx | Subdomain wordlist generation |
| shuffledns | DNS bruteforcing |
| cloudlist | Cloud asset discovery |
| notify | Notification system |
| interactsh | OOB interaction server |
| proxify | HTTP proxy |
| tldfinder | TLD discovery |
| urlfinder | URL extraction |
| vulnx | Vulnerability aggregation |

## API Key Configuration

Keys are stored in:
- `~/.config/PAI/.env` - PAI environment variables
- `~/.config/subfinder/provider-config.yaml` - Subfinder sources

To authenticate with PDCP (ProjectDiscovery Cloud Platform):
```bash
# Get your PDCP API key from https://cloud.projectdiscovery.io
pdtm -auth YOUR_PDCP_KEY
```

## Verification

After updating, verify tools work:
```bash
# Check versions
subfinder -version
httpx -version
nuclei -version

# Test basic functionality
echo "example.com" | subfinder -silent | head -5
```
