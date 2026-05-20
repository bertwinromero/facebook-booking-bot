# Facebook Booking Bot

AI-powered Facebook Messenger bot that helps users book consultations using Claude AI and Cal.com.

## Features

- Responds to Facebook Messenger messages with AI-generated replies
- Handles comments on Facebook posts
- Guides users through a booking flow
- Integrates with Cal.com for scheduling

## Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Facebook Developer App
- Cal.com account with API access
- Anthropic API key

## Setup

### 1. Clone and Install

```bash
cd facebook-booking-bot
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### 3. Setup Database

Run the schema in your Supabase SQL Editor:

```bash
# Copy contents of src/db/schema.sql to Supabase SQL Editor
```

### 4. Configure Facebook App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app (Business type)
3. Add Messenger product
4. Generate a Page Access Token
5. Configure webhook URL: `https://your-domain.com/webhook`
6. Subscribe to: `messages`, `messaging_postbacks`, `feed`

### 5. Configure Cal.com

1. Sign up at [cal.com](https://cal.com)
2. Create an event type
3. Get API key from Settings → Developer → API Keys
4. Note the Event Type ID from the URL

## Development

```bash
# Start development server with hot reload
npm run dev

# For local testing, use ngrok to expose your server
ngrok http 3000
```

## Deployment

### Railway

```bash
railway login
railway init
railway up
```

Set environment variables in Railway dashboard.

## Project Structure

```
src/
├── config/         # Environment configuration
├── db/             # Database client and schema
├── handlers/       # Message and comment handlers
├── prompts/        # AI system prompts
├── services/       # External service integrations
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
├── webhooks/       # Webhook routes
└── index.ts        # Application entry point
```

## Booking Flow

1. User sends message expressing interest in booking
2. Bot asks which service (30min or 60min consultation)
3. Bot shows available time slots from Cal.com
4. User selects a time
5. Bot collects name and email
6. Bot confirms booking details
7. Booking is created in Cal.com
8. User receives confirmation

## API Reference

- Facebook Graph API v25.0
- Cal.com API v1
- Anthropic Claude API

## License

ISC
