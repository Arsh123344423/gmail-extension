# Gmail Extension Backend with OAuth

This is the backend service for the Gmail Extension MVP with Google OAuth integration. It receives email prompts from the frontend, authenticates users with Google, parses prompts to extract email details, and schedules emails to be sent at specified times via Gmail API.

## Features

- Google OAuth 2.0 authentication
- Receives POST requests at `/api/send-email` with email prompts (requires authentication)
- Parses natural language prompts to extract recipient, subject, body, and send time
- Uses GitHub Actions every minute in production and node-cron locally to check for due emails
- Sends actual emails via Gmail API using user's OAuth tokens
- In-memory storage for scheduled emails and tokens (in a real app, use a database)

## Setup

### 1. Google Cloud Project Setup

To use this backend with real Gmail integration, you need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API for your project
4. Go to "APIs & Services" > "Credentials"
5. Create OAuth 2.0 Client ID credentials (Application type: Web application)
6. Set authorized redirect URI to: `http://localhost:3001/auth/google/callback` (for local dev)
7. Copy the Client ID and Client Secret

### 2. Environment Configuration

Create a `.env` file in the backend directory:

```
PORT=3001
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your-super-secret-session-key-change-in-production
GOOGLE_CLIENT_ID=your-google-client-id-from-google-cloud
GOOGLE_CLIENT_SECRET=your-google-client-secret-from-google-cloud
BASE_URL=http://localhost:3001  # Change to your production URL when deploying
CRON_SECRET=generate-a-long-random-secret
```

For production, set `CRON_SECRET` in both Vercel's environment variables and
the GitHub repository's Actions secrets. Add a repository variable named
`BACKEND_URL` containing the deployed backend URL. The workflow in
`.github/workflows/send-due-emails.yml` checks for due mail every minute.
GitHub may still delay scheduled workflow starts, so delivery is not guaranteed
precise-to-the-minute, but it is much closer to real-time than the previous
five-minute cadence. This avoids Vercel Cron's Hobby plan frequency limit.
After deploying, sign in with Google again so the backend can store an offline
refresh token in MongoDB.

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

## API Endpoints

### GET `/auth/google`
Initiates Google OAuth flow. Redirects user to Google for authentication.

### GET `/auth/google/callback`
Callback endpoint for Google OAuth. After successful authentication, redirects to frontend.

### GET `/auth/logout`
Logs out the current user and clears session.

### POST `/api/send-email`
Schedule an email to be sent. **Requires authentication.**

**Request Headers:**
```
Authorization: Bearer <session-cookie>
Content-Type: application/json
```

**Request Body:**
```json
{
  "prompt": "Send an email to john@example.com with subject 'Meeting Tomorrow' and body 'Don't forget our meeting at 10 AM tomorrow' at 9:00 AM"
}
```

**Response:**
```json
{
  "message": "Email scheduled successfully for 10/2/2026, 9:00:00 AM",
  "emailId": "123456789"
}
```

### GET `/health`
Health check endpoint that also returns authentication status.

## How It Works

1. User visits the frontend and clicks "Sign in with Google"
2. Frontend redirects to `/auth/google` which initiates OAuth flow
3. User signs in with Google and grants permissions (including Gmail send)
4. Google redirects back to `/auth/google/callback` with authorization code
5. Backend exchanges code for access/refresh tokens and stores them in session
6. User returns to frontend and can now schedule emails
7. When scheduling an email:
   - Backend validates user is authenticated via session
   - Parses the prompt to extract email details
   - Schedules the email using node-cron
   - At scheduled time, uses Gmail API with user's stored tokens to send email
8. User can logout via `/auth/logout` endpoint

## Email Sending Process

When it's time to send a scheduled email:

1. Backend retrieves user's OAuth tokens from memory storage
2. Creates a Gmail API instance with the tokens
3. Formats the email with proper headers (From, To, Subject, etc.)
4. Encodes the email in base64url format as required by Gmail API
5. Sends the email via `gmail.users.messages.send`
6. Logs the sent email confirmation

## Token Management

- Access tokens are stored in memory with expiry time (simplified for MVP)
- In a production implementation:
  - Use a secure database or Redis for token storage
  - Implement proper token refresh logic when access tokens expire
  - Encrypt refresh tokens at rest
  - Add token revocation handling

## Security Notes

### For Production Deployment:

1. **Use HTTPS**: Ensure your backend is served over HTTPS in production
2. **Secure Session Storage**: Use a secure session store (Redis, database) instead of memory
3. **HTTP Only Cookies**: Configure session cookies to be HTTP only and secure in production
4. **CSRF Protection**: Add CSRF protection for state-changing operations
5. **Rate Limiting**: Implement rate limiting on auth and email endpoints
6. **Input Validation**: Add more robust validation for email prompts
7. **Environment Variables**: Never commit `.env` file to version control
8. **Google OAuth Settings**: 
   - Set correct authorized domains in Google Cloud Console
   - Ensure OAuth consent screen is properly configured

## Limitations (MVP)

1. **Token Storage**: OAuth tokens are stored in MongoDB and require appropriate database access controls
2. **Scheduler Availability**: Production delivery depends on Vercel Cron invoking the backend once per minute
3. **Basic Error Handling**: Limited error recovery for failed email sends
4. **No Database**: No persistence of user data or email history
5. **No Refresh Token Flow**: Doesn't implement automatic token refresh when expired

Despite these limitations, this implementation demonstrates a working OAuth integration with Gmail API that allows users to:
- Sign in with their Google accounts
- Send emails via Gmail API using their credentials
- Schedule emails for future delivery
- Have emails sent from their actual Gmail address

## Environment Variables Reference

```
PORT=3001
SESSION_SECRET=your-super-secret-key-here
GOOGLE_CLIENT_ID=your-client-id-from-google-cloud
GOOGLE_CLIENT_SECRET=your-client-secret-from-google-cloud
BASE_URL=http://localhost:3001  # For local dev
# In production, set to your actual domain: https://yourdomain.com
```

## Dependencies Added for OAuth

- `passport`: Authentication middleware for Node.js
- `passport-google-oauth20`: Google OAuth strategy for Passport
- `express-session`: Session management for Express
- `googleapis`: Google API client library (includes Gmail API)

## Example Prompt Formats

After signing in with Google, users can enter prompts like:

- "Send an email to john@example.com with subject 'Meeting Tomorrow' and body 'Don't forget our meeting at 10 AM tomorrow' at 9:00 AM"
- "Email sarah@company.com subject 'Project Update' body 'The project is on track for completion next Friday' at 2:30 PM"
- "Send a reminder to team@dept.com subject 'Standup Meeting' body 'Daily standup in 5 minutes' at 9:55 AM"

The parsed email will be sent from the authenticated user's Gmail address.