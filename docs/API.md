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
