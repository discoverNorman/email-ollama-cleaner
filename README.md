# Email Ollama Cleaner

[![License: CC BY-NC-ND 4.0](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/)

TypeScript/Svelte application for email classification using Ollama LLM. Features a premium "2028 design" UI with animated trash truck progress indicators.

## Features

- **IMAP Email Scanning**: Connect to your email account and scan messages
- **Local LLM Classification**: Uses Ollama for privacy-focused email classification
- **Smart Categories**: Automatically sorts emails into spam, newsletter, or keep
- **Parallel Processing**: 16 workers with batch processing for high throughput
- **Premium UI**: 2028 design system with animated progress indicators
- **Unsubscribe Management**: Extract and track newsletter unsubscribe links

## Tech Stack

- **Backend**: Hono (TypeScript), Drizzle ORM, SQLite
- **Frontend**: Svelte 5, Tailwind CSS, Chart.js
- **AI**: Ollama (local LLM)

## Quick Start

See [CLAUDE.md](CLAUDE.md) for detailed setup instructions, API documentation, and configuration options.

```bash
npm install
npm run dev          # Start backend (port 3000)
npm run dev:frontend # Start frontend (port 5173)
```

## License

This work is licensed under a [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International License](https://creativecommons.org/licenses/by-nc-nd/4.0/).

**Personal use only.** You may not use this software for commercial purposes or create derivative works.

## Author

norman (info@agentdrivendevelopment.com)
