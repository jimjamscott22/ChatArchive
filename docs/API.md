# API

## Health
`GET /health`

Response:
```json
{ "status": "ok" }
```

## Import ChatGPT
`POST /import/chatgpt`

Form-data: `file` (the `conversations.json` export)

Response: list of imported conversations.

## Import History

### Get Import History
`GET /import/history`

Query parameters:
- `page` (optional): Page number (default: 1)
- `page_size` (optional): Items per page (default: 50, max: 100)
- `source_type` (optional): Filter by source type (e.g., "chatgpt", "claude")
- `status` (optional): Filter by status ("success", "failure", "partial")

Response:
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
      "created_at": "2025-12-29T16:30:00Z",
      "imported_count": 50,
      "error_message": null
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

### Get Single Import History Item
`GET /import/history/{history_id}`

Response: Single import history record with same structure as above.

## Import Settings

### Get Import Settings
`GET /settings/import`

Response:
```json
{
  "id": 1,
  "allowed_formats": "json,csv,xml",
  "default_format": "json",
  "auto_merge_duplicates": false,
  "keep_separate": true,
  "skip_empty_conversations": true,
  "updated_at": "2025-12-29T16:30:00Z"
}
```

### Update Import Settings
`PUT /settings/import`

Request body (all fields optional):
```json
{
  "allowed_formats": "json,csv,xml",
  "default_format": "json",
  "auto_merge_duplicates": false,
  "keep_separate": true,
  "skip_empty_conversations": true
}
```

Response: Updated settings object with same structure as GET endpoint.
