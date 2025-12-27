# ChatArchive

> A powerful, self-hosted tool to organize, search, and manage your LLM conversation history from ChatGPT, Claude, and other AI assistants.

![ChatArchive Preview](https://github.com/jimjamscott22/ChatArchive/blob/main/img/demoUI.png)

## 🌟 Features

- **Universal Import**: Support for ChatGPT, Claude, and other LLM export formats
- **Smart Search**: Full-text search with keyword filtering and advanced queries
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
- **npm** or **yarn**

### Current Status

This repo now includes a minimal FastAPI + React scaffold so you can import
ChatGPT `conversations.json` exports and store them locally in SQLite. Claude
and other importers are planned next.

### Next Steps

- Parse and normalize ChatGPT messages into separate tables (conversations, messages, participants).
- Add a conversation list/search endpoint and UI to browse imports.
- Add a Claude importer stub + selector in the upload form.
- Wire environment-driven config for API URL and allowed CORS origins.

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

3. **Install backend dependencies**
   ```bash
   cd ../backend
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize the database**
   ```bash
   python -m app.database.init_db
   ```

6. **Start the application**
   
   In one terminal (backend):
   ```bash
   cd backend
   python -m app.main
   ```
   
   In another terminal (frontend):
   ```bash
   cd frontend
   npm run dev
   ```

7. **Open your browser**
   
   Navigate to `http://localhost:5173`

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
- SQLite/PostgreSQL for storage
- Full-text search with FTS5

## 📖 Documentation

- [API Documentation](docs/API.md)
- [Import Guide](docs/IMPORT_GUIDE.md)
- [Development Setup](docs/DEVELOPMENT.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## 🎯 Roadmap

- [x] Basic UI and layout
- [x] File import system
- [ ] ChatGPT parser
- [ ] Claude parser
- [ ] Full-text search
- [ ] Tag management
- [ ] Advanced filtering
- [ ] Semantic search with embeddings
- [ ] Conversation summaries
- [ ] Export functionality
- [ ] Analytics dashboard
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
