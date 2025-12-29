# Import Guide

## ChatGPT
1. Open ChatGPT settings → Data Controls → Export Data.
2. Download the export and locate `conversations.json`.
3. In ChatArchive, upload the file on the import screen.

## Claude and Others
Parsers are planned. For now, only ChatGPT JSON is supported.

## Import & Export Settings

ChatArchive provides a comprehensive settings system to customize your import behavior and track import history.

### Accessing Settings

Click the **Settings** button in the left sidebar to open the Import & Export Settings modal.

### Import Settings

Configure how ChatArchive handles your imports:

#### File Format Preferences

- **Allowed Formats**: Specify which file formats are accepted for import (json, csv, xml). Enter formats as comma-separated values.
- **Default Format**: Select your preferred default format (JSON, CSV, or XML).

#### Import Behavior

- **Auto-merge duplicate conversations**: When enabled, ChatArchive will automatically merge imported conversations with existing ones if they share the same source ID. This prevents duplicate entries in your archive.

- **Keep imported data separate**: When enabled, each import creates a separate archive instead of merging with existing data. This is useful for maintaining distinct collections or testing imports.

- **Skip empty conversations**: When enabled, ChatArchive will skip conversations that contain no messages during import. This helps keep your archive clean and focused on meaningful conversations.

### Import History

The Import History tab shows a complete log of all your past imports with the following information:

- **Date & Time**: When the import was performed
- **File Name**: The name of the imported file
- **Source**: The platform the data came from (ChatGPT, Claude, etc.)
- **Format**: The file format (JSON, CSV, XML)
- **Status**: Import result
  - **Success**: Import completed without errors
  - **Failure**: Import failed
  - **Partial**: Some items imported successfully
  - **Processing**: Import currently in progress
- **Imported**: Number of conversations successfully imported

#### Error Details

If any imports failed, an "Error Details" section appears at the bottom of the history list, showing the specific error messages for each failed import.

### Best Practices

1. **Before large imports**: Check your import settings to ensure they match your preferences
2. **Enable auto-merge**: If you frequently re-import data from the same source to get updates
3. **Keep separate**: If you're experimenting or want to maintain distinct archives
4. **Review import history**: Regularly check the import history to ensure all imports completed successfully

### Troubleshooting

If an import fails:
1. Check the Import History for specific error messages
2. Verify the file format matches the expected format
3. Ensure the file isn't corrupted or empty
4. Check that your allowed formats include the file type you're trying to import
