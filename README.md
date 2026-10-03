# Gmail Extension MVP with Google OAuth

This is a Minimum Viable Product (MVP) for a Gmail extension that allows users to write email prompts in natural language, sign in with their Google accounts, and schedule emails to be sent at specific times via Gmail API.

## Project Structure

- `frontend/` - Next.js application where users sign in with Google and input email prompts
- `backend/` - Express server with Google OAuth that processes prompts and schedules emails via Gmail API

## Features

### Frontend (Next.js)
- Google OAuth 2.0 authentication (Sign in with Google)
- Clean, modern interface with Tailwind CSS
- User profile display after login
- Textarea for entering email prompts in natural language
- Real-time feedback on email scheduling status
- Responsive design
- Protected email scheduling (requires authentication)

### Backend (Node.js/Express)
- Google OAuth 2.0 authentication flow
- REST API endpoint to receive email prompts (requires authentication)
- Natural language parsing to extract email details (recipient, subject, body, time)
- Email scheduling using node-cron
- Actual email sending via Gmail API using user's OAuth tokens
- Session management for authentication state

## How It Works

1. **Authentication**: User signs in with their Google account via OAuth 2.0
2. **Permission Granting**: User grants permission for the app to send emails via Gmail
3. **User Input**: User enters a prompt like:
   ```
   Send an email to john@example.com with subject 'Meeting Tomorrow' and body 'Don't forget our meeting at 10 AM tomorrow' at 9:00 AM
   ```
4. **Frontend to Backend**: The frontend sends this prompt to the backend API endpoint `/api/send-email` (with session cookies)
5. **Prompt Parsing**: The backend parses the prompt to extract:
   - Recipient: `john@example.com`
   - Subject: `Meeting Tomorrow`
   - Body: `Don't forget our meeting at 10 AM tomorrow`
   - Send Time: `9:00 AM` (parsed and scheduled for today or tomorrow if time has passed)
6. **Email Scheduling**: The email is scheduled using node-cron to be sent at the specified time
7. **Email Delivery**: At the scheduled time, the backend uses Gmail API with the user's stored OAuth tokens to send the email from their actual Gmail address

## Local Development Setup

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Google Cloud Project with OAuth credentials (see setup below)

### Google Cloud Project Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API for your project
4. Go to "APIs & Services" > "Credentials"
5. Create OAuth 2.0 Client ID credentials (Application type: Web application)
6. Set authorized redirect URI to: `http://localhost:3001/auth/google/callback`
7. Copy the Client ID and Client Secret

### Backend Setup
```bash
cd backend
npm install

# Create .env file with your Google OAuth credentials
cp .env.example .env
# Edit .env and add:
# GOOGLE_CLIENT_ID=your-actual-client-id
# GOOGLE_CLIENT_SECRET=your-actual-client-secret
# SESSION_SECRET=your-super-secret-session-key
# BASE_URL=http://localhost:3001

npm start             # or npm run dev for development
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local  # Add NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
npm run dev
```

## Environment Variables

### Backend (`.env`)
```
PORT=3001
SESSION_SECRET=your-super-secret-key-change-in-production
GOOGLE_CLIENT_ID=your-google-client-id-from-google-cloud
GOOGLE_CLIENT_SECRET=your-google-client-secret-from-google-cloud
BASE_URL=http://localhost:3001  # For local dev
# In production, set to your actual domain: https://yourdomain.com
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

## Deployment

### Frontend
The Next.js frontend can be deployed to:
- Vercel (recommended)
- Netlify
- AWS Amplify
- Any Node.js hosting platform

### Backend
The Node.js backend can be deployed to:
- Vercel Serverless Functions
- AWS Lambda
- Google Cloud Functions
- Any Node.js hosting platform (Heroku, Render, etc.)

**Important**: When deploying to production, you must:
1. Update the `BASE_URL` in backend `.env` to your production URL
2. Update the authorized redirect URI in Google Cloud Console to match your production callback URL
3. Ensure your frontend's `NEXT_PUBLIC_BACKEND_URL` points to your deployed backend

## Future Enhancements

1. **Database Storage**: Replace in-memory storage with a proper database (PostgreSQL, MongoDB, etc.) for tokens and scheduled emails
2. **Refresh Token Flow**: Implement automatic token refresh when access tokens expire
3. **Improved Parsing**: Replace rule-based parser with actual AI (Claude API) for better natural language understanding
4. **User Dashboard**: Show history of scheduled/sent emails
5. **Email Templates**: Allow users to save and reuse email templates
6. **Recurring Emails**: Support for daily, weekly, monthly recurring emails
7. **Email Tracking**: Track delivery, open rates, click-through rates, etc.
8. **Timezone Support**: Proper handling of different timezones
9. **Attachment Support**: Allow file attachments in emails
10. **CC/BCC Fields**: Support for carbon copy and blind carbon copy

## MVP Limitations

1. **In-Memory Storage**: Tokens and scheduled emails are stored in memory (lost on server restart)
2. **Simplified Token Expiry**: Basic expiry checking without automatic refresh in MVP
3. **Basic Error Handling**: Limited error handling and validation
4. **No Rate Limiting**: No protection against abuse (would need in production)
5. **Simple Prompt Parsing**: Uses regex-based parsing instead of AI for demonstration

Despite these limitations, this MVP demonstrates a complete working integration with:
- Google OAuth 2.0 authentication
- Gmail API for sending emails
- Natural language prompt processing
- Email scheduling functionality

Users can now:
1. Sign in with their Google accounts
2. Grant permission to send emails via Gmail
3. Enter email prompts in natural language
4. Schedule emails for future delivery
5. Have emails sent from their actual Gmail address at the specified time