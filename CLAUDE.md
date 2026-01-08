# Email Ollama Cleaner

TypeScript/Svelte application for email classification using Ollama LLM. Features a premium "2028 design" UI with animated trash truck progress indicators.

## Tech Stack

- **Backend**: Hono (TypeScript), Drizzle ORM, SQLite
- **Frontend**: Svelte 5, Tailwind CSS, Chart.js
- **AI**: Ollama (local LLM) with model-specific prompts

## Project Structure

```
src/
├── server.ts           # Hono server entry point
├── config.ts           # Environment configuration
├── types.ts            # Shared TypeScript types
├── db/
│   ├── schema.ts       # Drizzle ORM schema
│   └── index.ts        # Database connection
├── services/
│   ├── imap-client.ts  # IMAP client (mock + real)
│   ├── ollama-client.ts # Ollama API client with model-specific prompts
│   ├── email-processor.ts # Email processing with batch/parallel support
│   └── unsubscribe.ts  # Unsubscribe URL extraction
└── routes/
    └── api.ts          # API route handlers

frontend/
├── src/
│   ├── App.svelte      # Main application (Dashboard, Emails, Settings tabs)
│   ├── app.css         # Premium animations and 2028 design system
│   ├── main.ts         # Entry point
│   └── lib/
│       ├── api.ts      # API client
│       └── components/ # Svelte components
└── index.html          # Instant loading screen (no JS required)
```

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start backend dev server (port 3000)
npm run dev:frontend # Start Svelte dev server (port 5173)
npm run build        # Build for production
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Run database migrations
```

## Environment Variables

```bash
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
OLLAMA_HOST=http://192.168.1.207:11434
OLLAMA_MODEL=qwen2.5:0.5b    # Fast model, or llama3.2, gemma3, etc.
USE_MOCK_IMAP=true
DATABASE_URL=./emails.db
BATCH_SIZE=50
PORT=3000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check with Ollama status |
| GET | /api/stats | Aggregated email statistics |
| GET | /api/emails | List emails (query: classification, limit, offset) |
| POST | /api/scan | Trigger email scan with parallel workers |
| GET | /api/unsubscribe/pending | List pending unsubscribe tasks |
| POST | /api/unsubscribe/:id/complete | Mark unsubscribe task complete |
| GET | /api/scans | List scan history |

## Database Schema

- **emails**: Stores email metadata, classification, confidence
- **unsubscribe_tasks**: Tracks newsletter unsubscribe tasks
- **scan_logs**: Records scan history with statistics

## Classification Types

- `spam`: Phishing, scam, unsolicited junk
- `newsletter`: Marketing emails, subscriptions
- `keep`: Personal correspondence, work emails, real notifications from real people

## UI Features

- **Instant Loading**: Critical CSS in index.html for sub-100ms first paint
- **Epic Trash Truck**: Animated truck with flames, speed lines, dust clouds
- **2028 Design System**: Pill navigation, glassmorphism, spring animations
- **Three Tabs**: Dashboard (stats/charts), Emails (list), Settings
- **Real-time Progress**: Bottom status bar shows scan progress with ETA

## Supported Ollama Models

Model-specific prompts optimized for: `qwen2.5`, `llama3.2`, `phi3`, `gemma2`, `gemma3`, `mistral`, `tinyllama`, `orca-mini`

## Performance Settings (Optimized for Speed)

Default settings are tuned for maximum throughput:

| Setting | Default | Description |
|---------|---------|-------------|
| Model | `qwen2.5:0.5b` | Fastest model with good accuracy |
| Workers | 16 | Parallel queue workers |
| Concurrency | 12→16 | Parallel batch requests (auto-scales) |
| Batch Size | 8 | Emails per Ollama request |

**Throughput**: ~96 emails/round (8 emails × 12 concurrent requests)

### Speed Tips
- Pre-warm model: `curl $OLLAMA_HOST/api/generate -d '{"model":"qwen2.5:0.5b","prompt":"hi"}'`
- Use GPU acceleration on Ollama server
- Ensure low network latency to Ollama host
