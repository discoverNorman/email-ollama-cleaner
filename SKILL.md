# Email Classification Assistant

A skill for classifying emails using local LLM models via Ollama.

## Description

This skill enables AI agents to help users manage and classify their email inbox using locally-hosted LLM models. It provides expertise in email triage, spam detection, newsletter identification, and inbox organization.

## Capabilities

- **Email Classification**: Categorize emails as spam, newsletter, or keep
- **Batch Processing**: Process multiple emails efficiently with parallel workers
- **Model Selection**: Choose optimal Ollama models for classification tasks
- **Unsubscribe Management**: Track and manage newsletter unsubscriptions

## When to Use This Skill

Invoke this skill when users ask about:
- Cleaning up their email inbox
- Identifying spam or unwanted emails
- Managing newsletter subscriptions
- Setting up email classification with Ollama
- Optimizing LLM prompts for email tasks

## Instructions

### Email Classification Guidelines

When classifying emails, use these categories:

1. **spam**: Unsolicited emails, phishing attempts, scams, junk mail, unwanted promotional content
2. **newsletter**: Subscription-based emails, marketing from known companies, company updates the user signed up for
3. **keep**: Personal correspondence, work emails, receipts, important notifications, messages from real people

### Model-Specific Prompting

Different Ollama models perform best with tailored prompts:

- **qwen2.5**: Structured format, explicit task definitions
- **llama3.2**: Clear examples, instruction-following format
- **gemma3**: XML-style tags for structure
- **mistral**: [INST] wrapper format
- **phi3**: Concise prompts with bullet points

### Best Practices

1. **Batch emails** in groups of 5 for faster processing
2. **Use parallel workers** (up to 16) for large inboxes
3. **Keep model loaded** with `keep_alive: '30m'` for speed
4. **Truncate email bodies** to 200-500 chars for classification
5. **Set low temperature** (0.1) for consistent results

## Example Prompts

### Single Email Classification
```
Classify this email as spam, newsletter, or keep.

From: {sender}
Subject: {subject}
Body: {preview}

Reply JSON only: {"classification":"category","confidence":0.9}
```

### Batch Classification
```
Classify each email as spam, newsletter, or keep.

[1] From: ... Subject: ... Body: ...
[2] From: ... Subject: ... Body: ...

Reply JSON array: [{"classification":"category","confidence":0.9}]
```

## Resources

- `src/services/ollama-client.ts` - Model-specific prompt templates
- `src/services/email-processor.ts` - Batch processing logic
- `CLAUDE.md` - Project documentation and setup

## Requirements

- Ollama running locally or on network
- Gmail account with App Password (for IMAP access)
- Node.js 18+

## Author

Norman's Email Trash Hauling Service
