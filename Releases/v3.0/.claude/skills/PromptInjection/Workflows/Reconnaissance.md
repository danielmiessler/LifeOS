# Reconnaissance - Application Discovery & Attack Surface Mapping

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the Reconnaissance workflow in the PromptInjection skill to map attack surface"}' \
  > /dev/null 2>&1 &
```

Running the **Reconnaissance** workflow in the **PromptInjection** skill to map attack surface...

**Workflow for:** Initial intelligence gathering, attack surface mapping, application analysis

## Purpose

Extract comprehensive application intelligence to identify injection points, understand architecture, and map the attack surface for prompt injection testing.

## Prerequisites

- Written authorization documented
- Target URL/application specified
- Browser automation available (BrowserAutomation skill)
- Testing environment configured

## Workflow Steps

### Step 1: Initial Application Analysis

**Navigate to target:**
```
browser navigate https://target-app.com
```

**Capture initial state:**
- Screenshot homepage
- Note visible AI/LLM components
- Identify authentication requirements
- Document application purpose

### Step 2: DOM Extraction

**Extract complete DOM structure:**
```
browser extract "complete DOM structure including all input fields, forms, buttons, and interactive elements"
```

**Analysis focus:**
- All input fields (text, textarea, file uploads)
- Form submission endpoints
- Interactive chat interfaces
- AI-powered features
- Hidden fields and parameters
- JavaScript event handlers

### Step 3: JavaScript Analysis

**Extract and analyze JavaScript:**
```
browser extract "all JavaScript code, configuration objects, and API endpoints referenced in scripts"
```

**Look for:**
- API endpoint URLs
- Authentication tokens/headers
- WebSocket connections
- Configuration parameters
- Client-side validation logic
- AI/LLM integration code

### Step 4: Network Traffic Capture

**Monitor network activity:**
```
browser network-logs /api/
browser network-logs /chat/
browser network-logs /completion/
```

**Capture:**
- API request/response patterns
- Request parameters and structure
- Response format
- Authentication mechanisms
- Rate limiting behavior
- Error messages

### Step 5: API Endpoint Enumeration

**Identify all endpoints:**
- Chat/completion endpoints
- File upload endpoints
- Configuration endpoints
- Authentication endpoints
- Data retrieval endpoints

**Document for each endpoint:**
- HTTP method (GET, POST, etc.)
- Required parameters
- Optional parameters
- Authentication requirements
- Response format

### Step 6: AI/LLM Component Identification

**Locate AI integration points:**
- Chat interfaces
- Completion widgets
- Document processing features
- RAG systems
- Agent/assistant features

**Document:**
- Component type (chatbot, completion, agent)
- Input methods (text, file, voice)
- Output format
- Context handling
- Memory/history features

### Step 7: Attack Surface Mapping

**Synthesize findings into attack surface map:**

**Direct injection points:**
- Text input fields
- Chat interfaces
- Prompt templates
- System instructions

**Indirect injection points:**
- File uploads
- Web scraping targets
- API data sources
- Email processing
- Social media integration

**High-value targets:**
- Admin interfaces
- Configuration endpoints
- System prompt access
- User data retrieval
- Privileged operations

## Output Documentation

**Create reconnaissance report:**

```markdown
# Reconnaissance Report - [Target Application]

## Application Overview
- URL: [target URL]
- Purpose: [application purpose]
- AI/LLM Components: [list]

## Attack Surface Summary

### Direct Injection Points
1. [Input field/endpoint] - [description]
2. [Chat interface] - [description]
...

### Indirect Injection Points
1. [File upload] - [description]
2. [Web scraping] - [description]
...

### API Endpoints
| Endpoint | Method | Parameters | Auth | Notes |
|----------|--------|------------|------|-------|
| /api/chat | POST | message, context | Bearer | Main chat endpoint |
...

### High-Value Targets
1. [Target] - [why high-value]
2. [Target] - [why high-value]
...

## Recommended Testing Priority
1. [Highest priority target]
2. [Second priority]
...
```

## Integration with Testing Workflows

**Next steps after reconnaissance:**

1. **Direct Injection Testing** - Test highest-priority direct injection points
2. **Indirect Injection Testing** - Test file uploads, web scraping vectors
3. **Multi-Stage Attacks** - Combine findings for complex attack chains

## Automation Tips

**Script reconnaissance for faster assessment:**
```bash
# Automated reconnaissance script
browser navigate https://target-app.com
browser extract "DOM structure" > dom.txt
browser extract "JavaScript code" > js-code.txt
browser network-logs /api/ > network-logs.txt
```

**Parse results with grep/analysis:**
```bash
# Find all input fields
grep -i "input\|textarea\|contenteditable" dom.txt

# Find API endpoints
grep -Eo "https?://[a-zA-Z0-9./?=_-]*" js-code.txt | sort -u

# Find authentication patterns
grep -i "auth\|token\|bearer\|api-key" js-code.txt
```

## Complete Methodology Reference

**Full reconnaissance methodology:**
`~/.claude/skills/PromptInjection/APPLICATION-RECONNAISSANCE-METHODOLOGY.md`

**Attack taxonomy for prioritization:**
`~/.claude/skills/PromptInjection/COMPREHENSIVE-ATTACK-TAXONOMY.md`

## Success Criteria

Reconnaissance is complete when you have:
- [ ] Comprehensive attack surface map
- [ ] All API endpoints documented
- [ ] Input validation mechanisms identified
- [ ] AI/LLM integration points mapped
- [ ] High-value targets prioritized
- [ ] Testing plan created

**Time estimate:** 30-90 minutes depending on application complexity
