# Application Reconnaissance Methodology
## DOM/JS/API Extraction for Prompt Injection Testing

**Created:** 2025-11-07
**For:** Authorized Security Assessments
**Authorization:** For testing authorized systems only

---

## 🎯 Overview

This methodology uses browser automation to systematically extract and analyze web applications for prompt injection testing. It provides complete visibility into the application's attack surface including DOM structure, JavaScript code, API endpoints, and parameters.

**Authorization Required:** This methodology must only be used on systems where you have explicit written permission to test.

---

## 📋 Reconnaissance Phases

### Phase 1: Initial Application Discovery
### Phase 2: DOM Extraction & Analysis
### Phase 3: JavaScript Code Analysis
### Phase 4: Network Traffic Capture
### Phase 5: API Endpoint Enumeration
### Phase 6: Parameter Discovery
### Phase 7: AI/LLM Component Identification

---

## Phase 1: Initial Application Discovery

### 1.1 Target Specification

**Required Information:**
- Target URL(s)
- Authentication credentials (if applicable)
- Authorized scope boundaries
- Testing authorization documentation

**Documentation:**
```bash
# Create testing directory in current work
WORK_DIR=$(jq -r '.work_dir' ~/.claude/MEMORY/STATE/current-work.json)
mkdir -p ~/.claude/MEMORY/WORK/${WORK_DIR}/scratch/$(date +%Y-%m-%d-%H%M%S)_prompt-injection-test-TARGET/
cd ~/.claude/MEMORY/WORK/${WORK_DIR}/scratch/$(date +%Y-%m-%d-%H%M%S)_prompt-injection-test-TARGET/

# Document authorization
cat > AUTHORIZATION.md << 'EOF'
# Security Testing Authorization

**Target:** [TARGET URL/DOMAIN]
**Client:** [CLIENT NAME]
**Authorized By:** [NAME, TITLE]
**Date:** [DATE]
**Scope:** [IN-SCOPE URLS/FEATURES]
**Out of Scope:** [EXCLUDED URLS/FEATURES]
**Authorization Document:** [PATH TO SIGNED AUTHORIZATION]

This testing is authorized under {PRINCIPAL.NAME}'s security assessment engagement.
EOF
```

### 1.2 Initial Navigation

**Browser Automation Approach:**
```bash
# Navigate to target application
browser navigate https://target-app.com

# Take initial screenshot
browser screenshot

# Capture initial page state
browser extract "get the complete page structure including all visible elements, forms, inputs, buttons" '{"structure": "string"}'
```

**What to Document:**
- Application type (chatbot, document processor, search, etc.)
- Authentication mechanism (if any)
- Initial page structure
- Visible AI/LLM components
- User interaction flows

### 1.3 Authentication (if required)

**Automated Login Flow:**
```bash
# Navigate to login page
browser navigate https://target-app.com/login

# Fill credentials (using authorized test account)
browser act "fill in email field with test@authorized-domain.com"
browser act "fill in password field with [AUTHORIZED_TEST_PASSWORD]"
browser act "click the login button"

# Wait for redirect
browser screenshot

# Verify successful authentication
browser extract "confirm login success and capture any session indicators" '{"logged_in": "boolean", "user_info": "string"}'
```

---

## Phase 2: DOM Extraction & Analysis

### 2.1 Complete DOM Capture

**Extract Full DOM:**
```bash
# Get complete DOM structure
browser extract "extract the complete HTML DOM including all elements, attributes, and structure" '{"dom": "string"}'

# Save to file
# (Browser automation will provide the DOM content - save it)
```

**What to Look For:**
- Text input fields (potential injection points)
- Textareas (chat interfaces, document upload descriptions)
- File upload inputs (indirect injection via documents)
- Hidden form fields (may contain API endpoints or parameters)
- Data attributes (data-* attributes often contain API info)
- Custom web components (AI widget components)
- IFrames (embedded AI chat widgets)

### 2.2 Form Analysis

**Extract All Forms:**
```bash
# Identify all forms on the page
browser observe "find all forms on the page with their fields, actions, and methods"

# For each form, extract details
browser extract "extract all form elements including: form action URLs, input field names, input types, hidden fields, submit buttons" '{"forms": "string"}'
```

**Form Analysis Checklist:**
- Form action URLs (POST endpoints)
- Input field names (parameter names)
- Input types (text, file, hidden)
- Validation attributes (maxlength, pattern, required)
- Hidden fields with API keys or endpoints
- CSRF tokens (important for testing flow)

### 2.3 Input Field Discovery

**Comprehensive Input Enumeration:**
```bash
# Find all input fields
browser extract "find every input field, textarea, and contenteditable element with their IDs, names, placeholders, and attributes" '{"inputs": "string"}'
```

**Input Classification:**
- **High Priority:** Chat inputs, search boxes, document description fields
- **Medium Priority:** Profile fields, settings inputs, feedback forms
- **Low Priority:** Email, name, address fields (unless processed by LLM)

### 2.4 Custom Element Discovery

**Identify AI Components:**
```bash
# Look for AI-specific elements
browser extract "find any elements with 'ai', 'chat', 'bot', 'assistant', 'copilot', 'llm', 'gpt' in their class names, IDs, or attributes" '{"ai_components": "string"}'
```

**Common AI Component Patterns:**
- Chat widget containers: `<div class="chat-widget">`, `<div id="ai-assistant">`
- Message containers: `<div class="message">`, `<div class="ai-response">`
- Streaming indicators: `<div class="typing">`, `<span class="streaming">`

---

## Phase 3: JavaScript Code Analysis

### 3.1 JavaScript File Discovery

**Extract All Script Sources:**
```bash
# Get all JavaScript file URLs
browser extract "find all <script> tags and extract their src URLs, including inline scripts" '{"scripts": "string"}'
```

**JavaScript Sources to Analyze:**
- External script files (.js)
- Inline `<script>` blocks
- Event handlers (onclick, onload, etc.)
- Module scripts (type="module")

### 3.2 JavaScript Code Inspection

**What to Search For in JS Code:**

**API Endpoint Patterns:**
```javascript
// Look for these patterns in JavaScript:
fetch('https://api.example.com/chat')
axios.post('/api/completions')
api.call('generate-response')
const endpoint = 'https://api.example.com/v1/chat'
baseURL: 'https://api.example.com'
```

**API Key Exposure:**
```javascript
// Security issue - but helps identify the API being used:
const apiKey = 'sk-...'
Authorization: 'Bearer sk-...'
```

**Parameter Names:**
```javascript
// Common LLM API parameters:
{
  prompt: userInput,
  messages: conversationHistory,
  system: systemPrompt,
  context: retrievedDocuments,
  temperature: 0.7,
  max_tokens: 2000
}
```

**Function Names:**
```javascript
// AI-related functions:
sendChatMessage()
streamCompletion()
generateResponse()
processWithAI()
askAssistant()
```

### 3.3 Console Log Monitoring

**Capture Console Activity:**
```bash
# Clear previous logs
browser clear-logs

# Interact with application
browser act "type a test message and submit"

# Capture console logs
browser console-logs

# Look for errors or debug info
browser console-logs error
```

**What Console Logs Reveal:**
- API call URLs (often logged for debugging)
- Request/response data
- Error messages with endpoints
- Debug information about AI processing
- WebSocket connections

---

## Phase 4: Network Traffic Capture

### 4.1 Network Log Collection

**Comprehensive Network Monitoring:**
```bash
# Clear logs to start fresh
browser clear-logs

# Navigate and interact with application
browser navigate https://target-app.com/chat
browser act "send a test message to the AI"
browser act "wait for the response to complete"

# Capture all network traffic
browser network-logs

# Filter for API calls
browser network-logs /api/
browser network-logs .json
```

**Network Log Analysis:**
- Request URLs (API endpoints)
- Request methods (POST, GET, PUT, DELETE)
- Request headers (Authorization, Content-Type, Custom headers)
- Request bodies (JSON payloads with parameters)
- Response bodies (API responses, error messages)
- Response status codes (200, 400, 401, 500)
- Request timing (identify streaming vs non-streaming)

### 4.2 API Call Pattern Recognition

**Common AI API Patterns:**

**OpenAI-style APIs:**
```bash
POST /v1/chat/completions
POST /v1/completions
POST /v1/embeddings
```

**Anthropic Claude:**
```bash
POST /v1/messages
POST /v1/complete
```

**Google Gemini:**
```bash
POST /v1/models/gemini-pro:generateContent
POST /v1/models/gemini-pro:streamGenerateContent
```

**Custom APIs:**
```bash
POST /api/chat
POST /api/completion
POST /api/ask
POST /api/query
```

### 4.3 WebSocket Detection

**Identify Real-Time Connections:**
```bash
# WebSocket connections appear in network logs
# Look for protocol upgrade to "websocket"
browser network-logs ws://
browser network-logs wss://
```

**WebSocket Analysis:**
- Connection URL
- Message format (JSON, plaintext, binary)
- Authentication mechanism
- Message frequency and patterns

---

## Phase 5: API Endpoint Enumeration

### 5.1 Endpoint Discovery Methods

**Method 1: Direct Network Log Analysis**
```bash
# Extract all unique API endpoints from network logs
# Parse browser network-logs output for URLs
# Deduplicate and categorize
```

**Method 2: JavaScript Static Analysis**
```bash
# Extract endpoints from JavaScript code
# Search for:
# - fetch() calls
# - axios requests
# - XMLHttpRequest
# - URL constants
# - API configuration objects
```

**Method 3: HTML Form Actions**
```bash
# Extract form action URLs
# Often reveals backend endpoints
```

### 5.2 Endpoint Classification

**Classify Endpoints by Function:**

**Chat/Completion Endpoints (HIGH PRIORITY):**
- `/api/chat` - Direct chat interface
- `/api/completion` - Text completion
- `/api/stream` - Streaming responses
- `/api/message` - Message submission

**Document Processing (HIGH PRIORITY):**
- `/api/upload` - File upload
- `/api/parse` - Document parsing
- `/api/analyze` - Document analysis
- `/api/extract` - Information extraction

**Search/Query (MEDIUM PRIORITY):**
- `/api/search` - Semantic search
- `/api/query` - Query processing
- `/api/ask` - Question answering

**Configuration (MEDIUM PRIORITY):**
- `/api/settings` - User settings
- `/api/preferences` - User preferences
- `/api/config` - System configuration

**Authentication (LOW PRIORITY for injection, but needed for testing):**
- `/api/login` - Authentication
- `/api/token` - Token refresh
- `/api/logout` - Session termination

### 5.3 Endpoint Documentation

**Create Endpoint Inventory:**
```markdown
# API Endpoint Inventory

## High Priority (Direct LLM Interaction)

### POST /api/chat
- **Purpose:** Send chat messages to AI
- **Authentication:** Bearer token
- **Parameters:** message, conversation_id, context
- **Response:** Streaming JSON
- **Injection Points:** message, context

### POST /api/upload
- **Purpose:** Upload documents for AI processing
- **Authentication:** Bearer token
- **Parameters:** file, description, metadata
- **Response:** JSON with document_id
- **Injection Points:** description, metadata, file content (indirect)

[Continue for all endpoints...]
```

---

## Phase 6: Parameter Discovery

### 6.1 Request Parameter Analysis

**Extract Parameters from Network Logs:**

**Common LLM API Parameters:**
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "USER INPUT HERE"}
  ],
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": true,
  "context": "Additional context from RAG",
  "instructions": "Special instructions",
  "tools": [...],
  "function_call": {...}
}
```

**Parameter Classification:**

**Critical Injection Points (TEST FIRST):**
- `message` / `content` / `prompt` - Direct user input
- `context` - Retrieved context (RAG poisoning vector)
- `system` / `system_prompt` - System instructions (if modifiable)
- `instructions` - Additional instructions
- `description` - Document descriptions
- `metadata` - File metadata

**Indirect Injection Vectors:**
- `url` - URLs that will be scraped
- `file` - File uploads (content will be processed)
- `search_query` - Search queries (results processed by LLM)
- `knowledge_base_id` - RAG source selection

**Configuration Parameters:**
- `temperature` - Response randomness
- `max_tokens` - Response length
- `stream` - Streaming mode
- `model` - Model selection

### 6.2 Parameter Testing Matrix

**Create Testing Plan:**
```markdown
# Parameter Testing Matrix

| Parameter | Type | Injection Vector | Priority | Test Cases |
|-----------|------|------------------|----------|------------|
| message | string | Direct injection | HIGH | Basic injection, obfuscation, multi-stage |
| context | string | Context poisoning | HIGH | RAG poisoning, instruction injection |
| description | string | Indirect injection | MEDIUM | File metadata injection |
| url | string | Web scraping injection | MEDIUM | Malicious webpage content |
| system_prompt | string | System override | HIGH | Instruction manipulation (if accessible) |
```

### 6.3 Hidden Parameter Discovery

**Look for Undocumented Parameters:**

**Method 1: JavaScript Analysis**
- Search for parameter names in JS code
- Look for commented-out parameters
- Check API client libraries

**Method 2: Error Message Analysis**
- Send malformed requests
- Analyze error messages for parameter hints
- Look for validation error details

**Method 3: Similar Endpoint Comparison**
- Compare parameters across similar endpoints
- Test parameters from one endpoint on another
- Look for inherited/shared parameters

---

## Phase 7: AI/LLM Component Identification

### 7.1 LLM Detection

**Identify AI/LLM Usage Indicators:**

**Direct Indicators:**
- Chat interfaces with AI branding
- "AI Assistant", "Copilot", "Chat with AI" labels
- Streaming text responses (typing effect)
- Response delays consistent with LLM inference
- Markdown or formatted responses

**API Indicators:**
```bash
# Network logs containing:
# - OpenAI API calls (api.openai.com)
# - Anthropic API calls (api.anthropic.com)
# - Google AI (generativelanguage.googleapis.com)
# - Azure OpenAI (openai.azure.com)
# - Custom LLM endpoints
```

**JavaScript Indicators:**
```javascript
// Search for these in JS code:
import { OpenAI } from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Or API key patterns:
const OPENAI_API_KEY = 'sk-...'
const ANTHROPIC_API_KEY = 'sk-ant-...'
```

**HTTP Header Indicators:**
```bash
# Look for these headers in network logs:
Authorization: Bearer sk-...
x-api-key: sk-...
anthropic-version: 2023-06-01
openai-organization: org-...
```

### 7.2 LLM Architecture Detection

**Determine LLM Implementation:**

**Client-Side LLM:**
- API calls directly from browser to LLM provider
- API keys visible in JavaScript (security issue!)
- Direct network requests to api.openai.com, etc.

**Server-Side LLM with Proxy:**
- API calls to custom backend
- Backend proxies to LLM provider
- More secure (API keys on server)

**RAG System Detection:**
- Multiple API calls per query (retrieval + generation)
- Vector database endpoints
- Document/knowledge base references
- Context injection in prompts

**Agent System Detection:**
- Multiple sequential API calls
- Tool/function calling
- Planning/reasoning steps
- Memory/state management

### 7.3 Component Mapping

**Create Component Diagram:**
```markdown
# LLM Architecture Map

## Flow Diagram
```
User Input → Web Form → POST /api/chat → Backend Server → OpenAI API
                                       ↓
                                  Vector DB (RAG)
                                       ↓
                                  Retrieved Context
                                       ↓
                                  Combined Prompt → LLM
                                       ↓
                                  Response → User
```

## Components
1. **Frontend:** React chat interface
2. **Backend:** Node.js API server
3. **LLM Provider:** OpenAI GPT-4
4. **RAG System:** Pinecone vector database
5. **Document Storage:** AWS S3

## Injection Points
1. User message (direct injection)
2. RAG documents (indirect injection via poisoning)
3. Document upload descriptions (indirect injection)
```

---

## 🔄 Automated Reconnaissance Workflow

### Complete Automation Script

**reconnaissance.sh - Full automated workflow:**
```bash
#!/bin/bash

# Prompt Injection Reconnaissance Automation
# For: {PRINCIPAL.NAME} Security Practice
# Authorization Required: Use only on authorized targets

set -e

# Configuration
TARGET_URL="$1"
OUTPUT_DIR="$(date +%Y-%m-%d-%H%M%S)_recon_$(echo $TARGET_URL | sed 's/https\?:\/\///' | sed 's/\//_/g')"

if [ -z "$TARGET_URL" ]; then
    echo "Usage: $0 <target-url>"
    echo "Example: $0 https://example-ai-app.com"
    exit 1
fi

echo "[*] Starting reconnaissance on $TARGET_URL"
echo "[*] Output directory: $OUTPUT_DIR"

mkdir -p "$OUTPUT_DIR"
cd "$OUTPUT_DIR"

# Phase 1: Initial Discovery
echo "[*] Phase 1: Initial Discovery"
browser navigate "$TARGET_URL" > initial_nav.json
browser screenshot
cp "$(find ~/.claude/Plugins/marketplaces/browser-tools/agent/browser_screenshots -type f -name '*.png' | tail -1)" initial_page.png

# Phase 2: DOM Extraction
echo "[*] Phase 2: DOM Extraction"
browser extract "extract complete HTML DOM" > dom.json

# Phase 3: Form Discovery
echo "[*] Phase 3: Form Discovery"
browser extract "find all forms with actions, methods, and input fields" > forms.json

# Phase 4: Input Field Discovery
echo "[*] Phase 4: Input Field Discovery"
browser extract "find all input fields, textareas, and contenteditable elements" > inputs.json

# Phase 5: AI Component Discovery
echo "[*] Phase 5: AI Component Discovery"
browser extract "find elements with ai, chat, bot, assistant, copilot, llm, gpt in class/id" > ai_components.json

# Phase 6: JavaScript Analysis
echo "[*] Phase 6: JavaScript Analysis"
browser extract "extract all script tags and their src URLs" > scripts.json

# Phase 7: Clear logs and prepare for interaction
echo "[*] Phase 7: Network Traffic Capture"
browser clear-logs

# Interact with chat if present
browser observe "find the chat input or message box"
browser act "find and click the chat or message input field"
browser act "type: Hello, this is a security test message"
browser act "submit the message or click send button"
browser act "wait 3 seconds for response"

# Phase 8: Capture Network Traffic
echo "[*] Phase 8: Capturing Network Logs"
browser network-logs > network_all.json
browser network-logs /api/ > network_api.json
browser network-logs .json > network_json.json

# Phase 9: Console Logs
echo "[*] Phase 9: Capturing Console Logs"
browser console-logs > console_all.json
browser console-logs error > console_errors.json

# Phase 10: Final Screenshot
echo "[*] Phase 10: Final State Capture"
browser screenshot
cp "$(find ~/.claude/Plugins/marketplaces/browser-tools/agent/browser_screenshots -type f -name '*.png' | tail -1)" final_page.png

# Cleanup
echo "[*] Phase 11: Cleanup"
browser close

# Generate Summary Report
echo "[*] Phase 12: Generating Summary Report"
cat > RECONNAISSANCE_SUMMARY.md << EOF
# Reconnaissance Summary

**Target:** $TARGET_URL
**Date:** $(date)
**Analyst:** {PRINCIPAL.NAME} Security Practice

## Files Generated
- initial_nav.json - Initial navigation response
- initial_page.png - Initial page screenshot
- dom.json - Complete DOM structure
- forms.json - All forms with fields
- inputs.json - All input fields
- ai_components.json - AI/LLM components
- scripts.json - JavaScript files
- network_all.json - All network traffic
- network_api.json - API calls only
- network_json.json - JSON responses
- console_all.json - Console logs
- console_errors.json - Console errors
- final_page.png - Final state screenshot

## Next Steps
1. Analyze network_api.json for API endpoints
2. Review forms.json and inputs.json for injection points
3. Parse scripts.json to extract API parameters from JavaScript
4. Review ai_components.json to understand LLM integration
5. Create testing plan based on discovered attack surface

## Authorization
This reconnaissance was conducted under authorized security testing engagement.
EOF

echo "[*] Reconnaissance complete!"
echo "[*] Results saved to: $OUTPUT_DIR"
echo "[*] Review RECONNAISSANCE_SUMMARY.md for next steps"
```

### Usage

```bash
# Make script executable
chmod +x reconnaissance.sh

# Run reconnaissance (authorization required)
./reconnaissance.sh https://target-ai-app.com

# Results will be in timestamped directory
```

---

## 📊 Analysis & Synthesis

### Post-Reconnaissance Analysis

**1. Endpoint Inventory Creation:**
```bash
# Parse network logs to extract unique endpoints
cat network_api.json | jq -r '.[] | .url' | sort -u > endpoints.txt
```

**2. Parameter Extraction:**
```bash
# Extract POST bodies to find parameters
cat network_api.json | jq -r '.[] | select(.method=="POST") | .postData' > parameters.json
```

**3. JavaScript Code Review:**
```bash
# Download all JavaScript files for offline analysis
cat scripts.json | jq -r '.scripts | split(",") | .[]' | while read url; do
    wget "$url" -P javascript/
done
```

**4. Attack Surface Mapping:**
Create comprehensive attack surface map combining:
- All identified injection points (input fields)
- All API endpoints with parameters
- All identified AI/LLM components
- Indirect injection vectors (file uploads, URLs)

---

## 🎯 Testing Prioritization

### Priority Matrix

**Priority 1 (Test First):**
- Direct chat message inputs
- Document upload description fields
- Search/query inputs processed by LLM
- System prompt parameters (if modifiable)

**Priority 2 (Test Second):**
- Profile/settings fields processed by LLM
- Feedback/support forms
- RAG document uploads (indirect injection)
- Email fields (if processed for auto-response)

**Priority 3 (Test Last):**
- Configuration parameters
- Display name fields
- Low-interaction fields unlikely to be processed by LLM

---

## 🔒 Security Considerations

### Responsible Testing

**Always:**
- ✅ Obtain written authorization before testing
- ✅ Document all authorization in AUTHORIZATION.md
- ✅ Test only in-scope targets
- ✅ Respect rate limits and avoid DoS
- ✅ Preserve evidence of findings
- ✅ Follow responsible disclosure practices

**Never:**
- ❌ Test systems without explicit permission
- ❌ Exceed authorized scope
- ❌ Perform denial-of-service testing
- ❌ Exfiltrate real user data
- ❌ Disclose vulnerabilities publicly before vendor has time to fix
- ❌ Use findings for malicious purposes

### Legal & Ethical Compliance

This methodology is provided for **authorized security testing only** as part of professional security assessment services.

**Unauthorized use of these techniques is illegal and unethical.**

---

END OF APPLICATION RECONNAISSANCE METHODOLOGY
