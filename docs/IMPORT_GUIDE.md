# Import Guide

ChatArchive supports importing conversations from multiple AI platforms. This guide will walk you through the process for each supported platform.

## Supported Platforms

- **ChatGPT** (OpenAI)
- **Claude** (Anthropic)
- **GitHub Copilot**
- **Gemini/Bard** (Google)

---

## ChatGPT

### How to Export

1. Open ChatGPT and go to Settings → Data Controls → Export Data
2. Click "Export" and wait for the email confirmation
3. Download the archive and extract `conversations.json`

### File Format

ChatGPT exports use a nested JSON structure with a tree-based message mapping system. Regenerations and edits create sibling branches. ChatArchive imports only the branch the ChatGPT UI was showing, identified by `current_node`. If that field is missing, the last-child path from the root is used (typically the latest regeneration). Other branches are not flattened into the same conversation.

**Example structure:**
```json
{
  "conversations": [
    {
      "id": "conversation-id",
      "title": "Conversation Title",
      "create_time": 1704067200,
      "current_node": "node-leaf",
      "mapping": {
        "node-root": {
          "parent": null,
          "children": ["node-leaf"]
        },
        "node-leaf": {
          "parent": "node-root",
          "message": {
            "author": {"role": "user"},
            "content": {"parts": ["Message content"]}
          }
        }
      }
    }
  ]
}
```

### Import to ChatArchive

1. Open ChatArchive and click the "Import" button
2. Select "ChatGPT" from the source dropdown
3. Choose your `conversations.json` file
4. Click "Import from ChatGPT"

---

## Claude

### How to Export

1. Visit [claude.ai/settings](https://claude.ai/settings)
2. Navigate to "Data & Privacy"
3. Click "Request your data export"
4. Wait for the email with your export (may take a few hours)
5. Download and extract the JSON file

### File Format

Claude exports contain conversations with structured chat messages.

**Example structure:**
```json
[
  {
    "uuid": "conversation-uuid",
    "name": "Conversation Name",
    "created_at": "2024-01-01T12:00:00Z",
    "chat_messages": [
      {
        "uuid": "message-uuid",
        "sender": "human",
        "text": "Message content",
        "created_at": "2024-01-01T12:00:00Z"
      }
    ]
  }
]
```

**Key features:**
- Sender roles: `human` (user) or `assistant`
- ISO 8601 timestamps
- Unique UUIDs for conversations and messages

### Import to ChatArchive

1. Open ChatArchive and click the "Import" button
2. Select "Claude" from the source dropdown
3. Choose your Claude export JSON file
4. Click "Import from Claude"

---

## GitHub Copilot

### How to Export

GitHub Copilot chat history can be exported from:
- **VS Code**: Extensions → Copilot → Settings → Export Chat History
- **GitHub.com**: Visit your Copilot settings and request an export

### File Format

Copilot exports support multiple format variations depending on the source.

**VS Code format:**
```json
[
  {
    "id": "session-id",
    "title": "Chat Title",
    "createdAt": "2024-01-01T12:00:00Z",
    "messages": [
      {
        "role": "user",
        "content": "Message content",
        "timestamp": "2024-01-01T12:00:00Z"
      }
    ]
  }
]
```

**Alternative format (sessions/exchanges):**
```json
{
  "sessions": [
    {
      "sessionId": "id",
      "exchanges": [
        {
          "author": "user",
          "message": "Content"
        }
      ]
    }
  ]
}
```

**Key features:**
- Flexible field names (role/author/sender)
- Supports code snippets and context
- Multiple timestamp formats (ISO, Unix)

### Import to ChatArchive

1. Open ChatArchive and click the "Import" button
2. Select "GitHub Copilot" from the source dropdown
3. Choose your Copilot export JSON file
4. Click "Import from GitHub Copilot"

---

## Gemini/Bard

### How to Export

1. Visit [Google Takeout](https://takeout.google.com/)
2. Deselect all products, then select only "Gemini Apps Activity" or "Bard"
3. Choose JSON format and delivery method
4. Create export and wait for the download link
5. Download and extract the archive. The activity log is typically at `Takeout/My Activity/Gemini Apps/MyActivity.json`

### File Format

Google Takeout **Gemini Apps Activity** is an event log, not a chat dump. ChatArchive reconstructs prompt/response turns from `details`, `userInteractions`, or title text, and groups events that share a conversation URL.

**Takeout Apps Activity (`MyActivity.json`):**
```json
[
  {
    "header": "Gemini",
    "title": "Used Gemini Apps",
    "titleUrl": "https://gemini.google.com/app/c/conversation-id",
    "time": "2024-02-17T22:05:10.123Z",
    "products": ["Gemini Apps"],
    "details": [
      {"name": "Request", "value": "User prompt"},
      {"name": "Response", "value": "Gemini reply"}
    ]
  }
]
```

Events with the same `titleUrl` are merged into one conversation, ordered by `time`. Generic titles such as "Used Gemini Apps" are replaced with the first prompt when possible. Activity items that still have no extractable text stay empty and are skipped when **Skip empty conversations** is enabled.

Conversation-shaped Gemini/Bard JSON (`messages`, `turns`, or `content`) is also accepted:

```json
{
  "conversations": [
    {
      "conversation_id": "id",
      "turns": [
        {
          "author": "user",
          "prompt": "User message"
        },
        {
          "author": "bard",
          "response": "Assistant response"
        }
      ]
    }
  ]
}
```

**Key features:**
- Sender roles: `user`, `human` (user) or `model`, `assistant`, `gemini`, `bard` (AI)
- Unix timestamps or ISO dates
- Model information preserved when present

### Import to ChatArchive

1. Open ChatArchive and click the "Import" button
2. Select "Gemini" from the source dropdown
3. Choose your `MyActivity.json` (or other Gemini/Bard JSON export)
4. Click "Import from Gemini"

---

## Import & Export Settings

ChatArchive provides a comprehensive settings system to customize your import behavior and track import history.

### Accessing Settings

Click the **Settings** button in the left sidebar to open the Import & Export Settings modal.

### Import Settings

Configure how ChatArchive handles your imports:

#### File Format Preferences

- **Allowed Formats**: Comma-separated file extensions that may be uploaded. Only JSON is implemented; a list that omits `json` will reject JSON uploads. CSV and XML import is not available.
- **Default Format**: JSON. Platform exports (ChatGPT, Claude, Copilot, Gemini Takeout) are JSON files.

#### Import Behavior

- **Auto-merge duplicate conversations**: When enabled, ChatArchive updates an existing conversation that shares the same source ID instead of inserting a duplicate. Enabling this turns off keep-separate.

- **Keep imported data separate**: When enabled, imported conversations are always inserted as new rows. Auto-merge is ignored (and the two checkboxes are mutually exclusive in the UI). This is not a separate archive entity.

- **Skip empty conversations**: When enabled, ChatArchive will skip conversations that contain no messages during import. This helps keep your archive clean and focused on meaningful conversations.

### Import History

The Import History tab shows a complete log of all your past imports with the following information:

- **Date & Time**: When the import was performed
- **File Name**: The name of the imported file
- **Source**: The platform the data came from (ChatGPT, Claude, Copilot, Gemini)
- **Format**: The file format (JSON)
- **Status**: Import result
  - **Success**: Import completed without errors
  - **Failure**: Import failed
  - **Partial**: Some items imported successfully
  - **Processing**: Import currently in progress
- **Imported**: Number of conversations successfully imported

#### Error Details

If any imports failed, an "Error Details" section appears at the bottom of the history list, showing the specific error messages for each failed import.

---

## Best Practices

1. **Before large imports**: Check your import settings to ensure they match your preferences
2. **Enable auto-merge**: If you frequently re-import data from the same source to get updates
3. **Keep separate**: If you're experimenting and do not want re-imports to update existing conversations
4. **Review import history**: Regularly check the import history to ensure all imports completed successfully
5. **Export regularly**: Keep backups of your ChatArchive data
6. **Verify format**: Ensure your export files match the expected format for each platform

---

## Troubleshooting

### Import Fails

If an import fails:
1. Check the Import History for specific error messages
2. Verify the file format matches the expected format for the selected platform
3. Ensure the file isn't corrupted or empty
4. Check that your allowed formats include `json` (JSON is the only supported import format)
5. Try re-exporting the data from the source platform

### Missing Messages

If some messages are missing after import:
- ChatArchive skips empty messages and certain system messages by design
- Check the message count in the Import History to verify
- Some platforms may have message limits on exports

### Timestamps Not Displayed

Different platforms use different timestamp formats. ChatArchive attempts to parse:
- Unix timestamps (seconds or milliseconds)
- ISO 8601 dates
- Various string formats

If timestamps are missing, the data may use an unsupported format.

### Duplicate Conversations

If you see duplicate conversations:
- Enable "Auto-merge duplicate conversations" in settings before re-importing
- Duplicates are identified by the source ID from the original platform

---

## Format Comparison

| Feature | ChatGPT | Claude | Copilot | Gemini |
|---------|---------|---------|---------|--------|
| Export Format | JSON | JSON | JSON | JSON |
| Message Threading | Tree-based | Linear | Linear | Linear |
| Timestamp Format | Unix (seconds) | ISO 8601 | ISO/Unix | Unix/ISO |
| Code Highlighting | ✓ | ✓ | ✓ | ✓ |
| Model Information | ✓ | ✓ | ✓ | ✓ |
| Multi-turn Support | ✓ | ✓ | ✓ | ✓ |
| Export Availability | Always | On request | Settings | Google Takeout |

---

## Need Help?

If you encounter issues not covered in this guide:
1. Check the [GitHub Issues](https://github.com/jimjamscott22/chatarchive/issues)
2. Review the [API Documentation](./API.md)
3. Open a new issue with details about your problem
