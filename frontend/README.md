# Gmail Extension Frontend with Google OAuth

This is the frontend for the Gmail Extension MVP built with Next.js. It provides a simple interface for users to sign in with their Google accounts and enter email prompts that are then sent to the backend for processing, scheduling, and sending via Gmail API.

## Features

- Google OAuth 2.0 authentication (Sign in with Google)
- Clean, modern UI built with Tailwind CSS
- User profile display after login
- Textarea for entering email prompts in natural language
- Real-time feedback on email scheduling status
- Responsive design
- Protected email scheduling (requires authentication)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file in the frontend directory:
   ```
   NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## How It Works

### Authentication Flow

1. User clicks "Sign in with Google" button
2. Frontend redirects to backend's `/auth/google` endpoint
3. Backend initiates Google OAuth flow
4. User signs in with Google and grants permissions (including Gmail send)
5. Google redirects back to backend's `/auth/google/callback`
6. Backend verifies authentication, creates session, and redirects back to frontend
7. Frontend checks authentication status via `/health` endpoint and displays user info

### Email Scheduling Flow

1. Authenticated user enters an email prompt in the textarea (e.g., "Send an email to john@example.com with subject 'Meeting Tomorrow' and body 'Don't forget our meeting at 10 AM tomorrow' at 9:00 AM")
2. When the form is submitted, the prompt is sent to the backend API at `/api/send-email` (with session cookies)
3. Backend validates user is authenticated via session
4. Backend parses the prompt, extracts email details, and schedules the email using node-cron
5. At the scheduled time, backend uses Gmail API with user's stored OAuth tokens to send the email
6. User receives feedback on whether the email was scheduled successfully

## Protected Routes

All email scheduling functionality requires authentication:
- The `/api/send-email` endpoint checks for authentication before processing
- If not authenticated, returns 401 error
- Frontend disables the form and shows login prompt when user is not signed in

## User Interface

### When Not Signed In:
- Prominent "Sign in with Google" button
- Instructions to sign in to use the service
- Disabled textarea and submit button

### When Signed In:
- User profile display (name, email, avatar)
- "Sign Out" button
- Enabled textarea for email prompts
- Submit button to schedule emails
- Status messages for scheduling results

## Prompt Examples

After signing in with Google, users can enter prompts like:

- "Send an email to john@example.com with subject 'Meeting Tomorrow' and body 'Don't forget our meeting at 10 AM tomorrow' at 9:00 AM"
- "Email sarah@company.com subject 'Project Update' body 'The project is on track for completion next Friday' at 2:30 PM"
- "Send a reminder to team@dept.com subject 'Standup Meeting' body 'Daily standup in 5 minutes' at 9:55 AM"

The parsed email will be sent from the authenticated user's Gmail address.

## Deployment

This frontend can be deployed to Vercel or any other Next.js hosting platform. Make sure to set the `NEXT_PUBLIC_BACKEND_URL` environment variable to point to your deployed backend.

When deploying to production:
1. Ensure your backend is deployed and accessible
2. Set `NEXT_PUBLIC_BACKEND_URL` to your production backend URL
3. Configure Google OAuth with correct authorized domains in Google Cloud Console
4. Update backend `BASE_URL` environment variable to match your production URL