# API Documentation

Base URL: `http://localhost:8000` (development)

## Health Check

### Get Health Status
`GET /health`

Check if the API is running.

**Response:**
```json
{
  "status": "ok"
}
```

---

## Import Endpoints

### Import ChatGPT Conversations
`POST /import/chatgpt`

Import conversations from a ChatGPT export file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the `conversations.json` export

**Response:**
```json
[
  {
    "id": 1,
    "source": "chatgpt",
    "source_id": "conv-abc123",
    "title": "Python Programming Help",
    "created_at": "2024-01-01T12:00:00",
    "updated_at": "2024-01-02T15:30:00",
    "message_count": 12
  }
]
```

### Import Claude Conversations
`POST /import/claude`

Import conversations from a Claude export file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the Claude JSON export

**Response:**
```json
[
  {
    "id": 2,
    "source": "claude",
    "source_id": "uuid-xyz789",
    "title": "Data Analysis Discussion",
    "created_at": "2024-01-03T09:15:00",
    "updated_at": "2024-01-03T10:45:00",
    "message_count": 8
  }
]
```

### Import GitHub Copilot Conversations
`POST /import/copilot`

Import conversations from a GitHub Copilot export file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the Copilot JSON export

**Response:**
```json
[
  {
    "id": 3,
    "source": "copilot",
    "source_id": "session-456",
    "title": "React Component Help",
    "created_at": "2024-01-04T14:20:00",
    "updated_at": "2024-01-04T14:45:00",
    "message_count": 6
  }
]
```

### Import Gemini/Bard Conversations
`POST /import/gemini`

Import conversations from a Gemini/Bard export file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field containing the Gemini JSON export

**Response:**
```json
[
  {
    "id": 4,
    "source": "gemini",
    "source_id": "gemini-conv-123",
    "title": "Creative Writing Ideas",
    "created_at": "2024-01-05T11:00:00",
    "updated_at": "2024-01-05T11:30:00",
    "message_count": 10
  }
]
```

**Error Responses:**

All import endpoints may return:
- `400 Bad Request`: Invalid file format or JSON structure
- `500 Internal Server Error`: Server error during import

Example error:
```json
{
  "detail": "Invalid JSON format"
}
```

---

## Conversation Endpoints

### List Conversations
`GET /conversations`

Get a paginated list of all conversations with filtering and sorting options.

**Query Parameters:**
- `page` (optional, default: 1): Page number (min: 1)
- `page_size` (optional, default: 50): Items per page (min: 1, max: 100)
- `source` (optional): Filter by source platform (`chatgpt`, `claude`, `copilot`, `gemini`)
- `sort_by` (optional, default: `created_at`): Field to sort by (`created_at`, `updated_at`, `title`, `message_count`)
- `sort_order` (optional, default: `desc`): Sort order (`asc`, `desc`)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "source": "chatgpt",
      "source_id": "conv-abc123",
      "title": "Python Programming Help",
      "created_at": "2024-01-01T12:00:00",
      "updated_at": "2024-01-02T15:30:00",
      "message_count": 12
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

### Get Conversation Sources
`GET /conversations/sources`

Get a list of all unique sources with conversation counts.

**Response:**
```json
[
  {
    "source": "chatgpt",
    "count": 25
  },
  {
    "source": "claude",
    "count": 15
  },
  {
    "source": "copilot",
    "count": 8
  },
  {
    "source": "gemini",
    "count": 6
  }
]
```

### Search Conversations
`GET /conversations/search`

Search conversations by title and optionally message content.

**Query Parameters:**
- `q` (required): Search query string
- `page` (optional, default: 1): Page number
- `page_size` (optional, default: 50): Items per page
- `source` (optional): Filter by source platform
- `search_messages` (optional, default: true): Also search message content

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "source": "chatgpt",
      "title": "Python Programming Help",
      "created_at": "2024-01-01T12:00:00",
      "message_count": 12
    }
  ],
  "total": 5,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

### Get Conversation Detail
`GET /conversations/{conversation_id}`

Get a single conversation with all its messages.

**Response:**
```json
{
  "id": 1,
  "source": "chatgpt",
  "source_id": "conv-abc123",
  "title": "Python Programming Help",
  "created_at": "2024-01-01T12:00:00",
  "updated_at": "2024-01-02T15:30:00",
  "message_count": 12,
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "How do I use list comprehensions in Python?",
      "content_type": "text",
      "created_at": "2024-01-01T12:00:00",
      "order_index": 0
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "List comprehensions provide a concise way to create lists...",
      "content_type": "text",
      "created_at": "2024-01-01T12:01:00",
      "order_index": 1
    }
  ]
}
```

### Delete Conversation
`DELETE /conversations/{conversation_id}`

Delete a conversation and all its messages.

**Response:**
```json
{
  "status": "deleted",
  "id": "1"
}
```

---

## Statistics

### Get Statistics
`GET /stats`

Get overall statistics about conversations and messages.

**Response:**
```json
{
  "total_conversations": 54,
  "total_messages": 486,
  "sources": {
    "chatgpt": 25,
    "claude": 15,
    "copilot": 8,
    "gemini": 6
  },
  "date_range": {
    "oldest": "2024-01-01T12:00:00",
    "newest": "2024-01-15T18:30:00"
  }
}
```

---

## Import History

### Get Import History
`GET /import/history`

Get a paginated list of import history records.

**Query Parameters:**
- `page` (optional, default: 1): Page number (min: 1)
- `page_size` (optional, default: 50): Items per page (min: 1, max: 100)
- `source_type` (optional): Filter by source type (`chatgpt`, `claude`, `copilot`, `gemini`)
- `status` (optional): Filter by status (`success`, `failure`, `partial`, `processing`)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "filename": "conversations.json",
      "source_location": null,
      "source_type": "chatgpt",
      "file_format": "json",
      "status": "success",
      "created_at": "2024-01-15T16:30:00",
      "imported_count": 50,
      "error_message": null
    },
    {
      "id": 2,
      "filename": "claude_export.json",
      "source_location": null,
      "source_type": "claude",
      "file_format": "json",
      "status": "success",
      "created_at": "2024-01-15T17:00:00",
      "imported_count": 15,
      "error_message": null
    }
  ],
  "total": 2,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

### Get Single Import History Item
`GET /import/history/{history_id}`

Get details for a specific import history record.

**Response:**
```json
{
  "id": 1,
  "filename": "conversations.json",
  "source_location": null,
  "source_type": "chatgpt",
  "file_format": "json",
  "status": "success",
  "created_at": "2024-01-15T16:30:00",
  "imported_count": 50,
  "error_message": null
}
```

---

## Import Settings

### Get Import Settings
`GET /settings/import`

Get current import settings.

`allowed_formats` is a comma-separated extension allowlist. Only JSON import is implemented; uploads that are not `.json`, or whose extension is omitted from the list, are rejected with HTTP 400. `keep_separate` disables duplicate merging even when `auto_merge_duplicates` is true.

**Response:**
```json
{
  "id": 1,
  "allowed_formats": "json",
  "default_format": "json",
  "auto_merge_duplicates": false,
  "keep_separate": true,
  "skip_empty_conversations": true,
  "updated_at": "2024-01-15T16:30:00"
}
```

### Update Import Settings
`PUT /settings/import`

Update import settings.

**Request Body** (all fields optional):
```json
{
  "allowed_formats": "json",
  "default_format": "json",
  "auto_merge_duplicates": false,
  "keep_separate": true,
  "skip_empty_conversations": true
}
```

**Response:**
```json
{
  "id": 1,
  "allowed_formats": "json",
  "default_format": "json",
  "auto_merge_duplicates": false,
  "keep_separate": true,
  "skip_empty_conversations": true,
  "updated_at": "2024-01-15T18:00:00"
}
```

---

## Data Models

### Conversation
```typescript
{
  id: number;
  source: "chatgpt" | "claude" | "copilot" | "gemini";
  source_id: string | null;
  title: string | null;
  created_at: string | null;  // ISO 8601 datetime
  updated_at: string | null;  // ISO 8601 datetime
  message_count: number;
}
```

### Message
```typescript
{
  id: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  content_type: string;
  created_at: string | null;  // ISO 8601 datetime
  order_index: number;
}
```

### Import History
```typescript
{
  id: number;
  filename: string;
  source_location: string | null;
  source_type: "chatgpt" | "claude" | "copilot" | "gemini";
  file_format: string;
  status: "success" | "failure" | "partial" | "processing";
  created_at: string;  // ISO 8601 datetime
  imported_count: number;
  error_message: string | null;
}
```

---

## Examples

### Import ChatGPT with cURL
```bash
curl -X POST http://localhost:8000/import/chatgpt \
  -F "file=@conversations.json"
```

### Import Claude with Python
```python
import requests

url = "http://localhost:8000/import/claude"
files = {"file": open("claude_export.json", "rb")}
response = requests.post(url, files=files)
print(response.json())
```

### Search Conversations with JavaScript
```javascript
const searchConversations = async (query) => {
  const response = await fetch(
    `http://localhost:8000/conversations/search?q=${encodeURIComponent(query)}`
  );
  return await response.json();
};

searchConversations("Python").then(data => console.log(data));
```
