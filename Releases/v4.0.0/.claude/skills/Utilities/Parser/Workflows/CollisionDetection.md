# Entity Collision Detection Workflow

## Voice Notification

```bash
curl -s -X POST http://localhost:8888/notify \
  -H "Content-Type: application/json" \
  -d '{"message": "Running the CollisionDetection workflow in the Parser skill to prevent duplicates"}' \
  > /dev/null 2>&1 &
```

Running the **CollisionDetection** workflow in the **Parser** skill to prevent duplicates...

## Purpose
Prevent duplicate entities across parsed content by maintaining a global entity index with GUIDs for people, companies, links, and sources.

## Entity Index Location
`~/.claude/skills/parser/entity-index.json`

## How It Works

### 1. Entity Canonical Identifiers

Each entity type has a canonical identifier used for collision detection:

- **People**: Normalized name (lowercase, trimmed)
  - `"John Smith"` → `"john smith"`
  - `"Andrej Karpathy"` → `"andrej karpathy"`

- **Companies**: Normalized domain (lowercase, trimmed)
  - `"anthropic.com"` → `"anthropic.com"`
  - `"openai.com"` → `"openai.com"`
  - If no domain: normalized name

- **Links**: Normalized URL (lowercase, trimmed, no trailing slash)
  - `"https://example.com/"` → `"https://example.com"`
  - `"HTTPS://SITE.COM/Path"` → `"https://site.com/path"`

- **Sources**: Normalized URL if available, otherwise normalized author + publication
  - With URL: `"https://arxiv.org/abs/123"` → `"https://arxiv.org/abs/123"`
  - Without URL: `"Claude Shannon"` + `"Information Theory"` → `"claude shannon|information theory"`

### 2. Collision Detection Process

When parsing new content:

#### Step 1: Load Entity Index
```python
import json

with open('entity-index.json', 'r') as f:
    entity_index = json.load(f)
```

#### Step 2: Check Each Extracted Entity

For each person/company/link/source extracted:

1. Compute canonical identifier
2. Check if canonical ID exists in index
3. If exists: **Reuse existing GUID**
4. If not exists: **Generate new GUID and add to index**

#### Step 3: Update Index

After processing all entities, update the entity index file with new entries.

### 3. Entity Index Structure

```json
{
  "version": "1.0.0",
  "last_updated": "2025-11-14T18:00:00Z",
  "people": {
    "john smith": {
      "id": "uuid-here",
      "name": "John Smith",
      "first_seen": "2025-11-14T17:30:10Z",
      "occurrences": 2,
      "content_ids": ["content-uuid-1", "content-uuid-2"]
    }
  },
  "companies": {
    "anthropic.com": {
      "id": "uuid-here",
      "name": "Anthropic",
      "domain": "anthropic.com",
      "first_seen": "2025-11-14T17:30:10Z",
      "occurrences": 1,
      "content_ids": ["content-uuid-1"]
    }
  },
  "links": {
    "https://example.com/blog/post": {
      "id": "uuid-here",
      "url": "https://example.com/blog/post",
      "first_seen": "2025-11-14T17:30:10Z",
      "occurrences": 1,
      "content_ids": ["content-uuid-1"]
    }
  },
  "sources": {
    "https://arxiv.org/abs/123": {
      "id": "uuid-here",
      "url": "https://arxiv.org/abs/123",
      "author": "Claude Shannon",
      "publication": "Information Theory",
      "first_seen": "2025-11-14T17:30:10Z",
      "occurrences": 1,
      "content_ids": ["content-uuid-1"]
    }
  }
}
```

### 4. Benefits

**Deduplication:**
- Avoid creating duplicate entities across content
- Maintain single source of truth for each entity

**Knowledge Graph:**
- Track entity occurrences across content
- Build relationships between content items
- Enable "who else mentioned this person?" queries

**Skip Already Parsed Content:**
- Check if URL already exists in links index
- Skip re-parsing if content GUID already exists

**Collision Detection:**
- Detect when same person/company appears in multiple pieces
- Merge information over time

## Implementation Examples

### Python Implementation

```python
import json
import uuid
from datetime import datetime

def normalize_name(name):
    """Normalize person/company name for canonical ID"""
    return name.lower().strip()

def normalize_url(url):
    """Normalize URL for canonical ID"""
    return url.lower().strip().rstrip('/')

def get_or_create_person(person_data, entity_index, content_id):
    """Get existing GUID or create new one for person"""
    canonical_id = normalize_name(person_data['name'])

    if canonical_id in entity_index['people']:
        # Entity exists - reuse GUID
        existing = entity_index['people'][canonical_id]
        existing['occurrences'] += 1
        existing['content_ids'].append(content_id)
        return existing['id']
    else:
        # New entity - create GUID
        person_id = str(uuid.uuid4())
        entity_index['people'][canonical_id] = {
            'id': person_id,
            'name': person_data['name'],
            'first_seen': datetime.utcnow().isoformat() + 'Z',
            'occurrences': 1,
            'content_ids': [content_id]
        }
        return person_id

# Similar functions for companies, links, sources...
```

### TypeScript Implementation

```typescript
import { v4 as uuidv4 } from 'uuid';

interface EntityIndex {
  version: string;
  last_updated: string;
  people: Record<string, PersonEntity>;
  companies: Record<string, CompanyEntity>;
  links: Record<string, LinkEntity>;
  sources: Record<string, SourceEntity>;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

function normalizeUrl(url: string): string {
  return url.toLowerCase().trim().replace(/\/$/, '');
}

function getOrCreatePerson(
  personData: { name: string; /* ... */ },
  entityIndex: EntityIndex,
  contentId: string
): string {
  const canonicalId = normalizeName(personData.name);

  if (entityIndex.people[canonicalId]) {
    // Reuse existing GUID
    const existing = entityIndex.people[canonicalId];
    existing.occurrences++;
    existing.content_ids.push(contentId);
    return existing.id;
  } else {
    // Create new GUID
    const personId = uuidv4();
    entityIndex.people[canonicalId] = {
      id: personId,
      name: personData.name,
      first_seen: new Date().toISOString(),
      occurrences: 1,
      content_ids: [contentId]
    };
    return personId;
  }
}
```

## Content Duplication Detection

Before parsing a URL, check if it's already in the index:

```python
def is_content_already_parsed(url, entity_index):
    """Check if this URL has already been parsed"""
    canonical_url = normalize_url(url)
    return canonical_url in entity_index['links']

def get_existing_content_id(url, entity_index):
    """Get content ID for already-parsed URL"""
    canonical_url = normalize_url(url)
    if canonical_url in entity_index['links']:
        link_data = entity_index['links'][canonical_url]
        if link_data['content_ids']:
            return link_data['content_ids'][0]  # Original content that included this link
    return None
```

## Workflow Integration

### Before Parsing
1. Load entity index
2. Check if source URL already exists in links index
3. If exists and is source link: skip parsing, return existing content ID
4. If not exists or is reference link: proceed with parsing

### During Entity Extraction
1. For each extracted person/company/link/source
2. Compute canonical identifier
3. Call `get_or_create_entity()` to get GUID
4. Assign GUID to entity in output JSON

### After Parsing
1. Save updated entity index
2. Update last_updated timestamp
3. Write to disk atomically (write to temp file, then rename)

## Schema Version

Current schema version: **1.0.0**

All entities must include GUID as required field (updated schema: `content-schema.json`).

## Maintenance

### Periodic Cleanup
- Remove entities with 0 occurrences (orphaned)
- Merge duplicate entries with similar canonical IDs
- Update stale metadata

### Backup
Entity index should be backed up regularly:
```bash
cp entity-index.json entity-index.backup.json
```

## Future Enhancements

1. **Fuzzy Matching**: Detect similar names (e.g., "Jon Smith" vs "John Smith")
2. **Alias Resolution**: Track multiple names for same entity
3. **Entity Merging**: UI to merge duplicate entities
4. **Conflict Resolution**: Handle cases where same name refers to different people
5. **Full-Text Search**: Enable searching across all indexed entities
