# ChatArchive

## A powerful, self-hosted tool to organize, search, and manage your LLM conversation history from ChatGPT, Claude, and other AI assistants.

![ChatArchive Preview](https://raw.githubusercontent.com/jimjamscott22/ChatArchive/main/ChatArchivescrnshtNew.png)

## 🌟 Features

- **Universal Import**: Support for ChatGPT, Claude, and other LLM export formats
- **Smart Search**: Full-text search with keyword filtering and advanced queries
- **Intelligent Tagging**: Automatic conversation categorization with 9 predefined tags (coding, education, writing, business, etc.)
- **Tag-Based Filtering**: Quickly find conversations by topic
- **Intuitive Organization**: Tag, categorize, and organize conversations effortlessly
- **Beautiful UI**: Clean, modern interface with dark/light mode support
- **Privacy First**: All data stays local - no cloud storage required
- **Export Options**: Export conversations to Markdown, JSON, or PDF
- **Advanced Analytics**: Visualize your conversation patterns and topics
- **Code Highlighting**: Automatic syntax highlighting for code snippets

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **uv** for Python environment and dependency management
- **npm** or **yarn**

### Current Status

This repo now includes a fully functional FastAPI + React application that supports importing conversations from multiple LLM platforms:
- ✅ ChatGPT (OpenAI) - Full support with tree-based message parsing
- ✅ Claude (Anthropic) - Full support with linear conversation format
- ✅ GitHub Copilot - Full support with flexible format handling
- ✅ Gemini/Bard (Google) - Full support with multiple export formats

All parsers are thoroughly tested with 78 unit and integration tests ensuring robust parsing and data normalization.

### ✨ New: Intelligent Tagging System

ChatArchive now includes automatic conversation categorization with 9 predefined tags:
- 🔵 **coding** - Programming and development
- 🟢 **education** - Academic topics and learning
- 🟣 **writing** - Creative writing and documentation
- 🟡 **productivity** - Task management and planning
- 🔴 **business** - Business and professional topics
- 🔵 **data-science** - ML, AI, and data analysis
- 🩷 **tech-support** - Troubleshooting and how-to
- 🟠 **creative** - Design and creative projects
- ⚫ **personal** - Personal conversations

See [Tagging Documentation](docs/TAGGING.md) for details on the classification algorithm and customization options.

### Next Steps

- Enhance search capabilities with semantic search using embeddings
- Implement export functionality (Markdown, PDF)
- Add analytics dashboard for conversation insights
- Create browser extension for auto-archiving

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jimjamscott22/chatarchive.git
   cd chatarchive
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install backend dependencies with uv**
   ```bash
   cd ../backend
   uv sync
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize the database**
   ```bash
   uv run python init_db.py
   ```

6. **Start the application with one script**
   ```bash
   ./run-chatarchive.sh
   ```

   This script starts:
   - a `uv sync` for the backend first
   - `npm install` for the frontend if `node_modules` is missing
   - the backend with `uv run python -m app.main`
   - the frontend with `npm run dev`

   If you prefer running them separately:
   ```bash
   cd backend
   uv run python -m app.main
   ```

   ```bash
   cd frontend
   npm run dev
   ```
# Find the process
```bash 
lsof -i :8000

# Kill it (replace PID with the actual process ID)
kill <PID>
```

7. **Open your browser**
   
   Navigate to `http://localhost:5173`

## 🗄️ Supabase Integration (Optional)

ChatArchive supports optional Supabase integration for cloud storage and PostgreSQL database, enabling multi-device access to your conversation history.

### Setting Up Supabase

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a free account
   - Create a new project and wait for it to initialize

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy your **Project URL** and **anon public** key
   - Go to Project Settings → API and copy your **service_role key**
   - Go to Project Settings → Database and copy your **database password** (or create a new one)

3. **Configure Environment Variables**
   ```bash
   cd backend
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_DB_PASSWORD=your-database-password
   SUPABASE_BUCKET_NAME=chatarchive-exports
   ```
   
   **Security Note**: Always use a dedicated database password (`SUPABASE_DB_PASSWORD`) rather than reusing the service role key for enhanced security.

4. **Create Storage Bucket**
   - In Supabase Dashboard, go to Storage
   - Create a new bucket named `chatarchive-exports`
   - Set it to private (recommended)

5. **Initialize Database Schema**
   
   ChatArchive uses Supabase PostgreSQL directly. On startup, the app validates your database connection and creates the schema automatically on first run.

6. **Migrate Existing Data (Optional)**
   
   If you have existing conversations in SQLite and want to migrate to Supabase:
   ```bash
   cd backend
   python migrate_to_supabase.py
   ```

7. **Enable Full-Text Search (Optional, recommended)**
   
   For faster, relevance-ranked search instead of basic ILIKE:
   ```bash
   cd backend
   python migrate_add_fulltext_search.py
   ```

### Benefits of Supabase Integration

- ✅ **Cloud Storage**: Raw export files backed up to Supabase storage
- ✅ **PostgreSQL Database**: More robust than SQLite for large datasets
- ✅ **Multi-Device Access**: Access your conversations from multiple devices
- ✅ **Automatic Backups**: Supabase handles database backups
- ✅ **Real-time Sync**: Changes sync across devices (future feature)

### Supabase Dashboard Access

When Supabase is configured, a database icon will appear in the ChatArchive header. Click it to open your Supabase admin dashboard directly.

### Database Requirement

Supabase configuration is required. If credentials are missing or invalid, backend startup fails with a clear configuration error instead of falling back to a local database.

### Keeping Your Free-Tier Supabase Project Active

Free-tier Supabase projects are **paused automatically after 1 week of inactivity**. ChatArchive ships a lightweight keepalive script and a scheduled GitHub Actions workflow to prevent this.

#### How it works

`backend/keepalive_supabase.py` sends a single low-cost `SELECT id LIMIT 1` request to your Supabase project's REST API. The GitHub Actions workflow runs this script every 12 hours.

#### Required GitHub repository secrets

Add the following secrets in your GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://yourproject.supabase.co`) |
| `SUPABASE_ANON_KEY` | Your project's `anon` / public API key |

#### Running manually

1. Go to **Actions → Supabase Keepalive** in your GitHub repository.
2. Click **Run workflow** to trigger it immediately.
3. Check the workflow logs to confirm `OK: Supabase keepalive succeeded`.

You can also run the script locally:

```bash
cd backend
SUPABASE_URL=https://yourproject.supabase.co \
SUPABASE_ANON_KEY=your-anon-key \
uv run python keepalive_supabase.py
```

Set `SUPABASE_KEEPALIVE_TABLE` to override the default table (`conversations`) used for the ping.

## 📦 Importing Your Chats

### ChatGPT
1. Go to ChatGPT Settings → Data Controls → Export Data
2. Download your data archive
3. In ChatArchive, click "Import" and select your `conversations.json` file

### Claude
1. Visit claude.ai/settings
2. Request your data export
3. Download the archive when ready
4. Import the JSON file into ChatArchive

### Other LLMs
Check our [Import Guide](docs/IMPORT_GUIDE.md) for detailed instructions on importing from various platforms.

## 🛠️ Tech Stack

**Frontend:**
- React 18 with TypeScript
- Tailwind CSS for styling
- Lucide React for icons
- Vite for build tooling

**Backend:**
- Python 3.10+
- FastAPI for REST API
- Supabase PostgreSQL for storage
- Full-text search with FTS5

## 📖 Documentation

- [API Documentation](docs/API.md)
- [Import Guide](docs/IMPORT_GUIDE.md)
- [Tagging System](docs/TAGGING.md)
- [Development Setup](docs/DEVELOPMENT.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## 🎯 Roadmap

- [x] Basic UI and layout
- [x] File import system
- [x] ChatGPT parser
- [x] Claude parser
- [x] Copilot parser
- [x] Gemini parser
- [x] Multi-platform import UI
- [x] Conversation list and detail views
- [x] Search functionality
- [x] Import history tracking
- [x] Comprehensive test coverage
- [x] Intelligent tagging system with 9 predefined categories
- [x] Tag-based filtering and organization
- [x] Full-text search (PostgreSQL tsvector with GIN index)
- [ ] Advanced filtering
- [ ] Semantic search with embeddings
- [ ] Conversation summaries
- [ ] Export functionality
- [x] Analytics dashboard
- [ ] Browser extension for auto-archiving
- [ ] Multi-user support
- [ ] Cloud sync (optional)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the GPL-3.0 license

## 🙏 Acknowledgments

- Inspired by the need for better LLM conversation management
- Built with modern web technologies
- Community-driven development

## 📧 Contact

Project Maintainer - [@jimjamscott22](https://github.com/jimjamscott22)

Project Link: [https://github.com/jimjamscott22/chatarchive](https://github.com/jimjamscott22/chatarchive)

---

⭐ Star this repo if you find it useful!

## 💡 Use Cases

- **Developers**: Archive coding conversations and solutions
- **Researchers**: Organize research discussions and findings
- **Writers**: Keep track of creative brainstorming sessions
- **Students**: Save educational conversations for later reference
- **Anyone**: Never lose an important AI conversation again!

## 🔒 Privacy & Security

- All data is stored locally on your machine
- No data is sent to external servers (unless you enable optional cloud sync)
- Open-source and auditable
- You own your data completely

## ⚡ Performance

- Handles thousands of conversations efficiently
- Fast search with indexing
- Lazy loading for smooth scrolling
- Optimized for large chat histories

## 🐛 Known Issues

See the [Issues](https://github.com/jimjamscott22/chatarchive/issues) page for current bugs and feature requests.

## 📊 Stats

![GitHub stars](https://img.shields.io/github/stars/jimjamscott22/chatarchive?style=social)
![GitHub forks](https://img.shields.io/github/forks/jimjamscott22/chatarchive?style=social)
![GitHub issues](https://img.shields.io/github/issues/jimjamscott22/chatarchive)
![GitHub license](https://img.shields.io/github/license/jimjamscott22/chatarchive)
