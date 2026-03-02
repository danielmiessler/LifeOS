# Authenticated Request Templates

These are example `req.txt` templates for common authenticated fuzzing scenarios.

## Template 1: JWT Bearer Token API Request

```http
GET /api/v1/users/FUZZ HTTP/1.1
Host: api.target.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
Accept: application/json
Content-Type: application/json
```

**Usage:**
```bash
ffuf --request req.txt -w wordlist.txt -ac -mc 200,201 -o results.json
```

---

## Template 2: Session Cookie + CSRF Token

```http
POST /api/account/update HTTP/1.1
Host: app.target.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
Cookie: sessionid=abc123xyz789; csrftoken=def456uvw; preferences=theme:dark
X-CSRF-Token: def456uvw
Content-Type: application/x-www-form-urlencoded
Content-Length: 25

field=FUZZ&action=update
```

**Usage:**
```bash
ffuf --request req.txt -w payloads.txt -ac -fc 403 -o results.json
```

---

## Template 3: API Key Header

```http
GET /v2/data/FUZZ HTTP/1.1
Host: api.target.com
User-Agent: Custom-Client/1.0
X-API-Key: YOUR_API_KEY_HERE_abc123def456ghi789jkl
Accept: application/json
```

**Usage:**
```bash
ffuf --request req.txt -w endpoints.txt -ac -mc 200 -o results.json
```

---

## Template 4: Basic Auth

```http
GET /admin/FUZZ HTTP/1.1
Host: target.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=
Accept: text/html,application/xhtml+xml
```

**Usage:**
```bash
ffuf --request req.txt -w admin-paths.txt -ac -mc 200,301,302 -o results.json
```

---

## Template 5: OAuth 2.0 Bearer

```http
GET /api/v1/resources/FUZZ HTTP/1.1
Host: api.target.com
User-Agent: OAuth-Client/2.0
Authorization: Bearer ya29.a0AfH6SMBx...truncated...aBcDeFgHiJ
Accept: application/json
Cache-Control: no-cache
```

**Usage:**
```bash
ffuf --request req.txt -w resource-names.txt -ac -mc 200,404 -fw 50-100 -o results.json
```

---

## Template 6: POST JSON with Auth

```http
POST /api/v1/query HTTP/1.1
Host: api.target.com
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Accept: application/json
Content-Length: 45

{"query":"FUZZ","limit":100,"offset":0}
```

**Usage:**
```bash
ffuf --request req.txt -w sqli-payloads.txt -ac -fr "error" -o results.json
```

---

## Template 7: Multiple FUZZ Points (Custom Keywords)

```http
GET /api/v1/users/USER_ID/documents/DOC_ID HTTP/1.1
Host: api.target.com
User-Agent: Mozilla/5.0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

**Usage:**
```bash
ffuf --request req.txt \
     -w user_ids.txt:USER_ID \
     -w doc_ids.txt:DOC_ID \
     -mode pitchfork \
     -ac -mc 200 \
     -o idor_results.json
```

---

## Template 8: GraphQL Query

```http
POST /graphql HTTP/1.1
Host: api.target.com
User-Agent: GraphQL-Client/1.0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
Accept: application/json
Content-Length: 89

{"query":"query { user(id: \"FUZZ\") { id username email role } }","variables":{}}
```

**Usage:**
```bash
ffuf --request req.txt -w user-ids.txt -ac -mc 200 -mr '"email"' -o graphql_results.json
```

---

## How to Capture Your Own Request

### Method 1: Burp Suite
1. Intercept the authenticated request in Burp
2. Right-click → "Copy to file"
3. Save as `req.txt`
4. Edit to replace the value you want to fuzz with `FUZZ`

### Method 2: Browser DevTools
1. Open DevTools (F12) → Network tab
2. Perform the authenticated action
3. Right-click on the request → "Copy" → "Copy as cURL"
4. Convert to raw HTTP format manually
5. Insert `FUZZ` keyword where needed

### Method 3: mitmproxy
1. Run `mitmproxy` or `mitmweb`
2. Configure browser to use proxy
3. Capture the request
4. Export as raw HTTP
5. Edit to add `FUZZ` keyword

### Method 4: curl to raw request
If you have a working curl command:
```bash
# Example curl:
curl 'https://api.target.com/users/123' \
  -H 'Authorization: Bearer TOKEN'

# Convert to req.txt:
GET /users/FUZZ HTTP/1.1
Host: api.target.com
Authorization: Bearer TOKEN
```

---

## Pro Tips

1. **Content-Length**: ffuf will automatically adjust `Content-Length` header if needed
2. **Multiple FUZZ points**: Use custom keywords like `USER_ID`, `DOC_ID` with `-w wordlist.txt:KEYWORD`
3. **Testing your req.txt**: Run with a single-value wordlist first to verify it works
4. **Token expiration**: Some tokens expire quickly - have a refresh strategy ready
5. **HTTPS by default**: Use `-request-proto http` if needed for HTTP-only targets
