# Tag-Based Conversation Categorization

## Overview

ChatArchive now includes an intelligent tag-based system to automatically categorize and organize your LLM conversations by topic. This feature helps you quickly find conversations based on their content and purpose.

## Features

### Automatic Tagging

The system uses a deterministic keyword-based classification engine that analyzes:
- **Conversation titles** (3 points per match)
- **Message content** (1 point per match, up to 5 matches)

A conversation is tagged if it scores at least 2 points for a particular category.

### Predefined Categories

The system includes 9 predefined categories with carefully curated keyword patterns:

1. **coding** 🔵
   - Programming, development, and technical topics
   - Keywords: python, javascript, code, git, api, debugging, etc.
   - Color: Blue (#3B82F6)

2. **education** 🟢
   - Academic topics, assignments, and learning
   - Keywords: assignment, homework, essay, study, exam, university, etc.
   - Color: Green (#10B981)

3. **writing** 🟣
   - Creative writing, content creation, and documentation
   - Keywords: write, story, article, blog, documentation, etc.
   - Color: Purple (#8B5CF6)

4. **productivity** 🟡
   - Task management, planning, and organization
   - Keywords: todo, schedule, plan, organize, workflow, etc.
   - Color: Amber (#F59E0B)

5. **business** 🔴
   - Business, finance, and professional topics
   - Keywords: business, company, startup, marketing, finance, etc.
   - Color: Red (#EF4444)

6. **data-science** 🔵
   - Data analysis, machine learning, and AI
   - Keywords: machine learning, data analysis, pandas, neural network, etc.
   - Color: Cyan (#06B6D4)

7. **tech-support** 🩷
   - Technical support, troubleshooting, and how-to
   - Keywords: how to, help, issue, problem, fix, troubleshoot, etc.
   - Color: Pink (#EC4899)

8. **creative** 🟠
   - Creative projects, design, and art
   - Keywords: design, ui, ux, art, creative, mockup, etc.
   - Color: Orange (#F97316)

9. **personal** ⚫
   - Personal topics and general conversation
   - Keywords: personal, life, advice, hobby, entertainment, etc.
   - Color: Gray (#6B7280)

## How It Works

### Classification Algorithm

The tagging engine uses a scoring system:

1. **Title Analysis**: Each keyword match in the title scores 3 points
2. **Content Analysis**: Each keyword match in user messages scores 1 point (max 5)
3. **Threshold**: A minimum score of 2 is required to assign a tag
4. **Limit**: Maximum of 3 tags per conversation

### Word Boundary Matching

The system uses regex word boundaries to ensure accurate matching:
- ✅ "class" matches "Python class"
- ❌ "class" does NOT match "classical music"
- ✅ Case-insensitive matching

### Multi-Tag Support

Conversations can have multiple tags. For example:
- "Web development assignment" → `coding`, `education`
- "Machine learning with Python" → `data-science`, `coding`

## Usage

### Auto-Tag All Conversations

Click the "Auto-Tag All" button in the sidebar to automatically tag all conversations based on their content.

```bash
POST /conversations/auto-tag
{
  "conversation_ids": [1, 2, 3],  // Optional: specific IDs
  "overwrite_existing": false     // Don't overwrite manual tags
}
```

### Filter by Tag

Use the tag dropdown in the sidebar to filter conversations by a specific tag.

```bash
GET /conversations?tag=coding
```

### Manual Tag Management

- **Add Tag**: Click on a conversation and use the tag menu
- **Remove Tag**: Click the × button on a tag badge in the conversation detail view

### API Endpoints

```bash
# List all tags with usage counts
GET /tags

# Create a custom tag
POST /tags
{
  "name": "my-custom-tag",
  "description": "My custom category",
  "color": "#FF5733"
}

# Add tag to conversation
POST /conversations/{id}/tags
{
  "tag_name": "coding",
  "auto_tagged": false
}

# Remove tag from conversation
DELETE /conversations/{id}/tags/{tag_id}
```

## Implementation Details

### Database Schema

**tags table:**
- `id`: Primary key
- `name`: Unique tag name
- `description`: Optional description
- `color`: Hex color code for UI display
- `created_at`: Timestamp

**conversation_tags table** (join table):
- `conversation_id`: Foreign key to conversations
- `tag_id`: Foreign key to tags
- `created_at`: Timestamp
- `auto_tagged`: Boolean flag (true for auto-assigned, false for manual)

### Testing

The system includes comprehensive tests:
- 16 unit tests for the tagging engine
- Classification accuracy tests
- Keyword matching tests
- Edge case handling

Run tests:
```bash
cd backend
pytest tests/test_tagger.py -v
```

## Customization

### Adding Custom Keywords

Edit `backend/app/tagger.py` to add keywords to existing categories:

```python
"coding": {
    "keywords": [
        # Add your custom keywords here
        "your-language", "your-framework",
    ]
}
```

### Creating New Categories

Add a new category to the `TAG_PATTERNS` dictionary:

```python
"your-category": {
    "description": "Description of your category",
    "color": "#HEXCOLOR",
    "keywords": ["keyword1", "keyword2", ...]
}
```

## Performance

- **Fast**: O(n) complexity where n is the number of keywords
- **Efficient**: Only analyzes first 10 messages per conversation
- **Scalable**: Handles thousands of conversations efficiently

## Limitations

1. **Language**: Currently optimized for English keywords
2. **Context**: Based on keywords, not semantic understanding
3. **Manual Override**: Some conversations may need manual tag adjustment

## Future Enhancements

Potential improvements:
- Semantic search using embeddings
- Multi-language support
- Custom tag creation from UI
- Tag hierarchies and subcategories
- Batch manual tagging
- Export conversations by tag

## Migration

If upgrading from a previous version:

```bash
cd backend
python migrate_add_tags.py
```

This creates the `tags` and `conversation_tags` tables without affecting existing data.

## Troubleshooting

**Tags not showing?**
- Ensure migration has been run
- Check that auto-tagging completed successfully
- Verify backend is running on port 8000

**Wrong tags assigned?**
- Tags are deterministic based on keywords
- Check the keyword patterns in `tagger.py`
- Use manual tag management to adjust

**Performance issues?**
- The system limits content analysis to first 10 messages
- Tags are cached in the database
- Consider indexing for large datasets

## Contributing

To improve the tagging system:
1. Add more keywords to existing categories
2. Suggest new categories
3. Improve classification algorithm
4. Add semantic understanding

See the main CONTRIBUTING.md for details.
