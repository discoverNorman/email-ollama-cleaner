# Email Ollama Cleaner

[![License: CC BY-NC-ND 4.0](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-FF3E00?logo=svelte&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==)

A privacy-focused email classification tool powered by local AI. Automatically categorize your emails into **spam**, **newsletters**, and **keep** using Ollama LLMs—all processed locally without sending data to external servers. Features a stunning "2028 design" UI with animated progress indicators and real-time statistics.

---

## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Deployment Options](#deployment-options)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)
- [Performance](#performance)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### Core Capabilities

- **Local AI Classification**: Powered by Ollama—your emails never leave your machine
- **IMAP Email Scanning**: Connect to Gmail (or any IMAP provider) and scan your inbox
- **Smart Categorization**: Three classification types:
  - `spam` - Phishing, scams, unsolicited junk
  - `newsletter` - Marketing emails, subscriptions
  - `keep` - Personal correspondence, work emails, important notifications
- **Parallel Processing**: Process ~96 emails per round with 16 workers and batch requests
- **Unsubscribe Tracking**: Automatically extract and track newsletter unsubscribe links
- **Scan History**: View past scans with statistics and performance metrics

### Premium UI (2028 Design)

- **Instant Loading**: Sub-100ms first paint with critical CSS in HTML
- **Animated Trash Truck**: Epic progress indicator with flames, speed lines, and dust clouds
- **Glassmorphism**: Modern pill navigation with blur effects and spring animations
- **Three Tabs**:
  - **Dashboard**: Overview with charts and statistics
  - **Emails**: Filterable list of all processed emails
  - **Settings**: Configuration and system status
- **Real-time Progress**: Bottom status bar with live ETA and throughput metrics

---

## Demo

### UI Screenshots

**Dashboard Tab**
- Email classification charts (Chart.js)
- Total emails processed, spam/newsletter/keep counts
- Recent scan history

**Emails Tab**
- Filter by classification type
- View email subjects, senders, dates, confidence scores
- Click to view unsubscribe links (for newsletters)

**Settings Tab**
- Ollama connection status
- Model configuration
- System health check

---

## Deployment Options

This application can run in **two modes**:

### 1. Desktop App (Electron) - Recommended for Privacy

**Best for**: Maximum privacy, offline use, local Ollama processing

Run as a native desktop application with:
- System tray integration
- Auto-start backend server
- Local database and AI processing
- Minimize to tray
- Native notifications

**Quick Start**:
```bash
npm install
npm run electron:dev  # Development mode
```

**Build Installers**:
```bash
npm run electron:build        # All platforms
npm run electron:build:win    # Windows (.exe, portable)
npm run electron:build:mac    # macOS (.dmg)
npm run electron:build:linux  # Linux (.AppImage, .deb, .rpm)
```

Installers will be in the `dist-electron/` directory.

### 2. Web App - Easy Access

**Best for**: Quick testing, remote access, shared hosting

Run as a traditional web application:
- Access from any browser
- Can use remote Ollama server
- Deploy to cloud hosting (Vercel, Netlify, VPS)
- Share with multiple users

**Quick Start**:
```bash
npm install

# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
npm run dev:frontend
```

Navigate to `http://localhost:5173`

### Choosing Your Mode

| Feature | Desktop (Electron) | Web App |
|---------|-------------------|---------|
| **Privacy** | Maximum (all local) | Good (can use local Ollama) |
| **Setup** | One-click install | Manual start |
| **Access** | Single machine | Any browser |
| **Updates** | Auto-updater | Manual pull |
| **System Tray** | Yes | No |
| **Offline** | Yes (with local Ollama) | No |

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Ollama** - [Download](https://ollama.ai/)
  - Install and run on your machine or a local server
  - Download a model: `ollama pull qwen2.5:0.5b` (recommended for speed)

### Gmail App Password (Optional)

If using real IMAP (not mock mode):
1. Enable 2-factor authentication on your Google account
2. Generate an App Password: [Google Account Security](https://myaccount.google.com/security)
3. Use the 16-character app password in your `.env` file

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/discoverNorman/email-ollama-cleaner.git
cd email-ollama-cleaner
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Configuration](#configuration) below).

### 4. Initialize Database

Run database migrations:

```bash
npm run db:migrate
```

This creates a SQLite database (`emails.db`) with the required schema.

### 5. Start the Application

**Development mode** (recommended for testing):

```bash
# Terminal 1: Start backend server (port 3000)
npm run dev

# Terminal 2: Start frontend dev server (port 5173)
npm run dev:frontend
```

**Production mode**:

```bash
npm run build
npm start
```

Navigate to `http://localhost:5173` (dev) or `http://localhost:3000` (production).

---

## Configuration

Edit your `.env` file with the following variables:

### IMAP Settings

```bash
# Gmail IMAP Configuration
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # 16-character app password

# Use mock IMAP for testing (generates fake emails)
USE_MOCK_IMAP=true  # Set to false to use real IMAP
```

### Ollama Settings

```bash
# Ollama server URL (local or remote)
OLLAMA_HOST=http://localhost:11434

# Model to use (see supported models below)
OLLAMA_MODEL=qwen2.5:0.5b  # Fastest model (recommended)
# OLLAMA_MODEL=llama3.2     # More accurate but slower
# OLLAMA_MODEL=gemma2       # Alternative option
```

### App Settings

```bash
# Database file location
DATABASE_URL=./emails.db

# Number of emails to fetch per IMAP scan
BATCH_SIZE=50

# Server port
PORT=3000
```

### Supported Ollama Models

Model-specific prompts are optimized for:
- `qwen2.5:0.5b` - **Recommended** (fastest, ~96 emails/round)
- `llama3.2` - Balanced speed/accuracy
- `phi3` - Microsoft's small model
- `gemma2` / `gemma3` - Google's models
- `mistral` - Mistral AI
- `tinyllama` - Ultra-fast, lower accuracy
- `orca-mini` - Small OpenOrca model

**Speed Tip**: Pre-warm your model before scanning:
```bash
curl http://localhost:11434/api/generate -d '{"model":"qwen2.5:0.5b","prompt":"hi"}'
```

---

## Usage

### Starting a Scan

1. Open the application in your browser (`http://localhost:5173`)
2. Navigate to the **Dashboard** tab
3. Click the **"Start Scan"** button
4. Watch the animated trash truck as it processes emails
5. View real-time progress in the bottom status bar

### Viewing Classified Emails

1. Go to the **Emails** tab
2. Use the filter dropdown to select:
   - All emails
   - Spam only
   - Newsletters only
   - Keep only
3. Click on an email to view details
4. For newsletters, see extracted unsubscribe links

### Checking System Status

1. Navigate to the **Settings** tab
2. View:
   - Ollama connection status
   - Current model
   - API health check
   - Database statistics

---

## API Documentation

The backend exposes a REST API on port 3000:

### Health Check

```http
GET /api/health
```

**Response**:
```json
{
  "status": "ok",
  "ollama": {
    "connected": true,
    "model": "qwen2.5:0.5b"
  }
}
```

### Get Statistics

```http
GET /api/stats
```

**Response**:
```json
{
  "total": 150,
  "spam": 45,
  "newsletter": 60,
  "keep": 45,
  "avgConfidence": 0.87
}
```

### List Emails

```http
GET /api/emails?classification=spam&limit=20&offset=0
```

**Query Parameters**:
- `classification` (optional): `spam`, `newsletter`, or `keep`
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

### Trigger Email Scan

```http
POST /api/scan
```

Starts an email scan with parallel workers. Returns scan progress.

### Get Pending Unsubscribe Tasks

```http
GET /api/unsubscribe/pending
```

Returns newsletters with unsubscribe links.

### Mark Unsubscribe Complete

```http
POST /api/unsubscribe/:id/complete
```

Marks an unsubscribe task as completed.

### List Scan History

```http
GET /api/scans
```

Returns all past scan logs with statistics.

---

## Architecture

### Tech Stack

**Backend**:
- **Hono** - Fast, lightweight web framework
- **Drizzle ORM** - Type-safe SQL ORM
- **SQLite** - Embedded database (via `better-sqlite3`)
- **ImapFlow** - Modern IMAP client
- **MailParser** - Email parsing

**Frontend**:
- **Svelte 5** - Reactive UI framework
- **Tailwind CSS** - Utility-first CSS
- **Chart.js** - Data visualization
- **Vite** - Build tool and dev server

**AI**:
- **Ollama** - Local LLM runtime

### Project Structure

```
email-ollama-cleaner/
├── src/
│   ├── server.ts              # Hono server entry point
│   ├── config.ts              # Environment configuration
│   ├── types.ts               # Shared TypeScript types
│   ├── db/
│   │   ├── schema.ts          # Drizzle ORM schema (emails, scans, tasks)
│   │   └── index.ts           # Database connection
│   ├── services/
│   │   ├── imap-client.ts     # IMAP client (mock + real)
│   │   ├── ollama-client.ts   # Ollama API client
│   │   ├── email-processor.ts # Email processing pipeline
│   │   ├── queue-worker.ts    # Parallel queue workers
│   │   └── unsubscribe.ts     # URL extraction
│   └── routes/
│       └── api.ts             # API route handlers
├── frontend/
│   ├── index.html             # Instant loading screen
│   ├── src/
│   │   ├── App.svelte         # Main app (tabs, routing)
│   │   ├── app.css            # 2028 design system
│   │   ├── main.ts            # Entry point
│   │   └── lib/
│   │       └── api.ts         # API client
│   └── vite.config.ts
├── .env.example
├── package.json
├── drizzle.config.ts
├── tsconfig.json
└── README.md
```

### Database Schema

**emails** table:
- `id`, `subject`, `from`, `to`, `date`, `body`
- `classification` (spam/newsletter/keep)
- `confidence` (0-1)
- `processed_at`

**unsubscribe_tasks** table:
- `id`, `email_id`, `url`, `status`, `created_at`

**scan_logs** table:
- `id`, `started_at`, `completed_at`, `total_emails`, `spam_count`, `newsletter_count`, `keep_count`

---

## Performance

### Default Settings (Optimized for Speed)

| Setting | Default | Description |
|---------|---------|-------------|
| Model | `qwen2.5:0.5b` | Fastest model with good accuracy |
| Workers | 16 | Parallel queue workers |
| Concurrency | 12→16 | Auto-scaling parallel requests |
| Batch Size | 8 | Emails per Ollama request |

**Throughput**: ~96 emails/round (8 emails × 12 concurrent requests)

### Performance Tips

1. **Use GPU acceleration** on your Ollama server
2. **Pre-warm the model** before large scans:
   ```bash
   curl http://localhost:11434/api/generate -d '{"model":"qwen2.5:0.5b","prompt":"test"}'
   ```
3. **Run Ollama locally** or ensure low network latency (<10ms)
4. **Use the fastest model** (`qwen2.5:0.5b`) for initial testing
5. **Increase batch size** in `.env` if your LLM has high throughput

---

## Development

### Available Scripts

#### Web App Development
```bash
npm run dev              # Start backend dev server (hot reload)
npm run dev:frontend     # Start Svelte dev server (hot reload)
npm run build            # Build both backend and frontend
npm run preview          # Preview production build
```

#### Electron App Development
```bash
npm run electron:dev           # Start Electron in development mode
npm run electron:build         # Build production Electron app (all platforms)
npm run electron:build:win     # Build for Windows only
npm run electron:build:mac     # Build for macOS only
npm run electron:build:linux   # Build for Linux only
```

#### Database
```bash
npm run db:generate      # Generate new Drizzle migrations
npm run db:migrate       # Run database migrations
```

### Making Code Changes

**Backend changes** (src/):
- Edit files in `src/`
- `tsx watch` will automatically reload the server

**Frontend changes** (frontend/src/):
- Edit Svelte components in `frontend/src/`
- Vite will hot-reload changes in the browser

### Database Migrations

After modifying `src/db/schema.ts`:

```bash
npm run db:generate  # Generates migration SQL
npm run db:migrate   # Applies migration
```

---

## Troubleshooting

### Ollama Connection Issues

**Problem**: "Failed to connect to Ollama"

**Solutions**:
1. Verify Ollama is running: `ollama list`
2. Check `OLLAMA_HOST` in `.env` matches your Ollama server
3. Test connectivity: `curl http://localhost:11434/api/tags`
4. Ensure the model is downloaded: `ollama pull qwen2.5:0.5b`

### IMAP Authentication Errors

**Problem**: "Invalid credentials" or "Authentication failed"

**Solutions**:
1. Use an **App Password**, not your regular Gmail password
2. Enable 2-factor authentication on your Google account
3. Generate a new App Password: [Google Account Security](https://myaccount.google.com/security)
4. Set `USE_MOCK_IMAP=true` in `.env` for testing without real IMAP

### Slow Classification

**Problem**: Email processing is too slow

**Solutions**:
1. Switch to a faster model: `OLLAMA_MODEL=qwen2.5:0.5b`
2. Pre-warm the model before scanning
3. Enable GPU acceleration in Ollama
4. Reduce `BATCH_SIZE` if hitting memory limits
5. Run Ollama on the same machine as the app

### Database Locked Errors

**Problem**: "Database is locked"

**Solutions**:
1. Ensure only one instance of the app is running
2. Close any SQLite browser tools
3. Delete `emails.db-shm` and `emails.db-wal` files (if safe)

### Electron App Issues

**Problem**: "App won't start" or blank window

**Solutions**:
1. Ensure you've built the frontend first: `npm run build`
2. Check console for errors: Open DevTools with Ctrl+Shift+I (Windows/Linux) or Cmd+Option+I (Mac)
3. Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
4. Check logs in terminal where you ran `npm run electron:dev`

**Problem**: "Backend not connecting" in Electron

**Solutions**:
1. Check `electron/main.js` console output for backend errors
2. Verify port 3000 is not already in use: `lsof -i :3000` (Mac/Linux) or `netstat -ano | findstr :3000` (Windows)
3. Try manually starting backend: `npm run dev` then `electron .`

**Problem**: Missing app icons

**Solutions**:
1. Add icon files to `electron/assets/` directory
2. See `electron/assets/README.md` for icon requirements
3. Temporary: Generate placeholder icons with ImageMagick or online tools
4. The app will work without icons but may show placeholders

**Problem**: Build fails with "Cannot find module"

**Solutions**:
1. Ensure `dist/` directory exists: `npm run build`
2. Check that `electron/main.js` and `electron/preload.js` are present
3. Verify all dependencies are installed: `npm install`
4. Try cleaning build cache: `rm -rf dist dist-electron && npm run build`

---

## Contributing

This project is licensed for **personal use only**. Commercial use and derivative works are not permitted under the CC BY-NC-ND 4.0 license.

If you have questions or feedback, contact: **info@agentdrivendevelopment.com**

---

## License

This work is licensed under a [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License](https://creativecommons.org/licenses/by-nc-nd/4.0/).

**You are free to**:
- View and study the code
- Download and run for personal use

**Under these terms**:
- **Attribution** - Credit must be given to the author
- **NonCommercial** - No commercial use allowed
- **NoDerivatives** - No modifications or derivative works may be distributed

For more details, see the [LICENSE](LICENSE) file.

---

## Author

**norman**
Email: info@agentdrivendevelopment.com
GitHub: [@discoverNorman](https://github.com/discoverNorman)

---

## Acknowledgments

- [Ollama](https://ollama.ai/) - Local LLM runtime
- [Svelte](https://svelte.dev/) - Reactive UI framework
- [Hono](https://hono.dev/) - Fast web framework
- [Drizzle ORM](https://orm.drizzle.team/) - Type-safe ORM

---

**Built with Claude Code** - AI-assisted development tool by Anthropic
