# Email Cleaner with Ollama Spam Detection

## Overview
An IMAP-based email processing system that uses a local Ollama instance to classify emails as spam or legitimate, and identifies newsletters with unsubscribe options for automated cleanup.

## Infrastructure

### Ollama Server
- **Host**: 192.168.1.207
- **Hardware**: Mac Mini M4, 16GB RAM
- **API Endpoint**: http://192.168.1.207:11434

### Email Provider
- **Provider**: Gmail
- **Protocol**: IMAP
- **IMAP Server**: imap.gmail.com
- **Port**: 993 (SSL)

## Core Features

### 1. IMAP Email Fetching
- Connect to Gmail via IMAP with OAuth2 or App Password
- Fetch unread emails from inbox
- Support batch processing to avoid rate limits
- Track processed emails to avoid duplicate analysis

### 2. Ollama Spam Classification
- Send email content (subject, sender, body) to Ollama for analysis
- Prompt engineering for spam detection:
  - Phishing attempts
  - Promotional spam
  - Scam emails
  - Legitimate emails
- Return classification with confidence score
- Suggested model: `llama3.2` or `mistral` (fits in 16GB RAM)

### 3. Newsletter Detection
- Identify emails with unsubscribe links
- Parse `List-Unsubscribe` header
- Extract unsubscribe URLs from email body
- Categorize newsletter type (marketing, updates, notifications)

### 4. Action Queue
- Store detected spam for review/deletion
- Store newsletter unsubscribe links for Playwright automation
- Export unsubscribe tasks as JSON for API/Playwright consumption

## Data Models

### Email Record
```json
{
  "id": "message_id",
  "from": "sender@example.com",
  "subject": "Email subject",
  "date": "2024-01-06T10:00:00Z",
  "classification": "spam|legitimate|newsletter",
  "confidence": 0.95,
  "unsubscribe_url": "https://...",
  "unsubscribe_method": "link|mailto|one-click",
  "processed_at": "2024-01-06T10:05:00Z"
}
```

### Unsubscribe Task
```json
{
  "id": "task_id",
  "email_id": "message_id",
  "sender": "newsletter@company.com",
  "unsubscribe_url": "https://...",
  "method": "playwright|api|mailto",
  "status": "pending|completed|failed",
  "created_at": "2024-01-06T10:05:00Z"
}
```

## API Endpoints (Optional REST API)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/emails/scan` | POST | Trigger email scan |
| `/emails/classified` | GET | List classified emails |
| `/unsubscribe/pending` | GET | Get pending unsubscribe tasks |
| `/unsubscribe/{id}/complete` | POST | Mark unsubscribe as done |

## Playwright Integration

### Unsubscribe Automation
- Read pending unsubscribe tasks from JSON/API
- Navigate to unsubscribe URL
- Handle common unsubscribe flows:
  - One-click unsubscribe buttons
  - Email confirmation forms
  - Preference center selections
- Screenshot confirmation pages
- Update task status on completion

## Configuration

```env
# Gmail IMAP
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Ollama
OLLAMA_HOST=http://192.168.1.207:11434
OLLAMA_MODEL=llama3.2

# Processing
BATCH_SIZE=50
SCAN_INTERVAL_MINUTES=30
```

## Tech Stack Suggestions

- **Language**: Python 3.11+
- **IMAP Library**: `imapclient` or `imaplib`
- **Ollama Client**: `ollama` Python package
- **Database**: SQLite (simple) or PostgreSQL
- **API Framework**: FastAPI (if REST API needed)
- **Automation**: Playwright Python

## Security Considerations

- Store Gmail App Password securely (env vars or secrets manager)
- Never log full email content
- Rate limit Ollama requests to avoid overload
- Validate unsubscribe URLs before automation

## Future Enhancements

- Web dashboard for reviewing classifications
- Custom spam rules/allowlists
- Email auto-archiving based on classification
- Statistics and reporting
- Multiple email account support
