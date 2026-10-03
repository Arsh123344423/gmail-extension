const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { google } = require('googleapis');
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

// Initialize Gemini AI
const geminiApiKey = process.env.GEMINI_API_KEY;
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
const geminiModel = genAI
  ? genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL })
  : null;

// MongoDB connection
const mongoClient = new MongoClient(process.env.MONGODB_URI);
const mongoClientPromise = mongoClient.connect();
let db;
let scheduledEmailsCollection;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await mongoClientPromise;
    db = mongoClient.db();
    scheduledEmailsCollection = db.collection('scheduledEmails');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    // Don't exit - allow app to run with reduced functionality
  }
}

// Initialize MongoDB connection
connectToMongoDB().catch(console.error);

/**
 * Extractor Agent: Identifies relevant information from prompts and potentially images/JSON
 */
class ExtractorAgent {
  /**
   * Extract structured information from a prompt
   * @param {string} prompt - The user's natural language prompt
   * @returns {Object} Extracted information
   */
  static extractFromPrompt(prompt) {
    // Extract email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = [...new Set(prompt.match(emailRegex) || [])]; // Remove duplicates

    // Extract potential JSON data (look for {...} patterns)
    const jsonMatches = prompt.match(/\{[^}]+\}/g) || [];
    let jsonData = [];
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match);
        jsonData.push(parsed);
      } catch (e) {
        // Not valid JSON, ignore
      }
    }

    // Extract time expressions
    const timeRegex = /(\d{1,2}):?(\d{0,2})\s*(am|pm)/gi;
    const timeMatches = prompt.match(timeRegex) || [];

    // Extract dates
    const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g;
    const dateMatches = prompt.match(dateRegex) || [];

    return {
      emails: emails.sort(), // Sorted alphabetically
      jsonData: jsonData,
      timeExpressions: [...new Set(timeMatches)].sort(), // Deduplicated and sorted
      dateExpressions: [...new Set(dateMatches)].sort(), // Deduplicated and sorted
      rawPrompt: prompt
    };
  }

  /**
   * Extract information from image description or metadata
   * @param {string} imageData - Base64 encoded image or image description
   * @returns {Object} Extracted information from image
   */
  static extractFromImage(imageData) {
    // In a real implementation, this would use computer vision or OCR
    // For now, we'll return a placeholder structure
    return {
      hasImage: !!imageData,
      imageSize: imageData ? imageData.length : 0,
      extractedText: imageData ? "[Image content would be extracted here]" : null
    };
  }
}

/**
 * Reviewer Agent: Checks mail formats and validates content
 */
class ReviewerAgent {
  /**
   * Validate email format and content
   * @param {Object} emailData - The email data to validate
   * @returns {Object} Validation result with errors if any
   */
  static validateEmailFormat(emailData) {
    const errors = [];

    // Check required fields
    if (!emailData.to || emailData.to.length === 0) {
      errors.push('No recipients specified');
    } else {
      // Validate each email address
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      for (const email of emailData.to) {
        if (!emailRegex.test(email)) {
          errors.push(`Invalid email format: ${email}`);
        }
      }
    }

    if (!emailData.subject || emailData.subject.trim() === '') {
      errors.push('Subject is required');
    }

    if (!emailData.body || emailData.body.trim() === '') {
      errors.push('Email body is required');
    }

    if (!emailData.sendTime) {
      errors.push('Send time is required');
    } else {
      const sendDate = new Date(emailData.sendTime);
      if (isNaN(sendDate.getTime())) {
        errors.push('Invalid send time format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Review extracted information for quality and completeness
   * @param {Object} extractedInfo - Information extracted by ExtractorAgent
   * @returns {Object} Review result
   */
  static reviewExtractedInfo(extractedInfo) {
    const review = {
      hasRecipients: extractedInfo.emails.length > 0,
      hasTimeInfo: extractedInfo.timeExpressions.length > 0 || extractedInfo.dateExpressions.length > 0,
      hasJsonData: extractedInfo.jsonData.length > 0,
      completenessScore: 0
    };

    // Calculate completeness score (0-100)
    let score = 0;
    if (review.hasRecipients) score += 40;
    if (review.hasTimeInfo) score += 30;
    if (review.hasJsonData) score += 20;
    if (extractedInfo.rawPrompt.length > 20) score += 10; // Reasonable prompt length

    review.completenessScore = score;

    return review;
  }
}

function getScheduledEmailTime(record) {
  return new Date(record.sendTime ?? record.emailDetails?.sendTime);
}

function getScheduledEmailDetails(record) {
  return record.emailDetails || {
    to: record.to,
    subject: record.subject,
    body: record.body,
    sendTime: record.sendTime
  };
}

function compareScheduledEmails(first, second) {
  return getScheduledEmailTime(first) - getScheduledEmailTime(second);
}

function getScheduledEmailQuery(sendTimeFilter, userId) {
  const query = {
    $and: [
      {
        $or: [
          { sendTime: sendTimeFilter },
          { 'emailDetails.sendTime': sendTimeFilter }
        ]
      },
      {
        $or: [
          { metadata: { $exists: false } },
          { 'metadata.status': 'validated' },
          { status: 'validated' }
        ]
      }
    ]
  };

  if (userId !== undefined) {
    query.userId = userId;
  }

  return query;
}

/**
 * Orchestrator Agent: Creates final JSON containing multiple datasets and coordinates storage
 */
class OrchestratorAgent {
  /**
   * Create a final email record for storage
   * @param {string} userId - The user ID
   * @param {Object} emailDetails - Parsed email details from prompt
   * @returns {Object} Final record for storage
   */
  static createEmailRecord(userId, emailDetails) {
    return {
      userId,
      emailDetails: {
        to: Array.isArray(emailDetails.to) ? emailDetails.to : [emailDetails.to],
        subject: emailDetails.subject,
        body: emailDetails.body,
        sendTime: new Date(emailDetails.sendTime)
      }
    };
  }

  /**
   * Store email record in MongoDB
   * @param {Object} record - The email record to store
   * @returns {Promise<Object>} The stored record with ID
   */
  static async storeEmailRecord(record) {
    if (!db || !scheduledEmailsCollection) {
      throw new Error('MongoDB not connected');
    }

    const result = await scheduledEmailsCollection.insertOne(record);
    return { ...record, _id: result.insertedId };
  }

  /**
   * Get scheduled emails for a user, sorted by send time
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} Array of scheduled emails sorted by send time
   */
  static async getUserScheduledEmails(userId) {
    if (!db || !scheduledEmailsCollection) {
      throw new Error('MongoDB not connected');
    }

    const emails = await scheduledEmailsCollection
      .find(getScheduledEmailQuery({ $exists: true }, userId))
      .toArray();

    return emails.sort(compareScheduledEmails);
  }

  /**
   * Get the next scheduled email for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Object|null>} The next scheduled email or null
   */
  static async getNextScheduledEmail(userId) {
    if (!db || !scheduledEmailsCollection) {
      throw new Error('MongoDB not connected');
    }

    const emails = await scheduledEmailsCollection
      .find(getScheduledEmailQuery({ $exists: true }, userId))
      .toArray();

    return emails.sort(compareScheduledEmails)[0] || null;
  }

  /**
   * Remove an email record from MongoDB (called when email is sent)
   * @param {string} recordId - The ID of the record to remove
   * @returns {Promise<boolean>} True if removed successfully
   */
  static async removeEmailRecord(recordId) {
    if (!db || !scheduledEmailsCollection) {
      throw new Error('MongoDB not connected');
    }

    const result = await scheduledEmailsCollection.deleteOne({ _id: new ObjectId(recordId) });
    return result.deletedCount > 0;
  }

  /**
   * Process a complete email scheduling request through all three agents
   * @param {string} userId - The user ID
   * @param {string} prompt - The user's natural language prompt
   * @param {string|null} imageData - Optional image data for extraction
   * @returns {Promise<Object>} Result of the processing
   */
  static async processEmailRequest(userId, prompt, imageData = null) {
    try {
      const emailDetailsList = await parseEmailPrompt(prompt);
      const validatedEmails = emailDetailsList.map(emailDetails => {
        const reviewResult = ReviewerAgent.validateEmailFormat(emailDetails);
        if (!reviewResult.isValid) {
          throw new Error(reviewResult.errors.join(', '));
        }

        const date = new Date(emailDetails.sendTime);
        if (Number.isNaN(date.getTime())) {
          throw new Error('Could not determine a valid email send time');
        }

        return { emailDetails, date };
      }).sort((first, second) => first.date - second.date);

      const scheduledEmails = [];
      for (const { emailDetails, date } of validatedEmails) {
        const emailRecord = OrchestratorAgent.createEmailRecord(userId, emailDetails);
        const storedRecord = await OrchestratorAgent.storeEmailRecord(emailRecord);

        scheduledEmails.push({
          recordId: storedRecord._id.toString(),
          nextSendTime: date.toISOString()
        });
      }

      return {
        success: true,
        recordId: scheduledEmails[0].recordId,
        recordIds: scheduledEmails.map(email => email.recordId),
        message: scheduledEmails.length === 1
          ? 'Email scheduled successfully'
          : `${scheduledEmails.length} emails scheduled successfully`,
        nextSendTime: scheduledEmails[0].nextSendTime,
        emails: scheduledEmails
      };
    } catch (error) {
      console.error('Error in OrchestratorAgent.processEmailRequest:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_URL
  ? new URL(process.env.FRONTEND_URL).origin
  : undefined;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin === FRONTEND_ORIGIN) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  store: MongoStore.create({
    clientPromise: mongoClientPromise,
    collectionName: 'sessions'
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware
app.use(express.json());

// In-memory storage for scheduled emails and user tokens
// In a real app, use a database
const scheduledEmails = [];

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Google OAuth strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
  callbackURL: `${process.env.BASE_URL || 'http://localhost:3001'}/auth/google/callback`,
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.send']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    await mongoClientPromise;
    const userTokensCollection = mongoClient.db().collection('userTokens');
    const existingTokens = await userTokensCollection.findOne({ _id: profile.id });
    const userProfile = {
      id: profile.id,
      email: profile.emails[0].value,
      name: `${profile.name.givenName} ${profile.name.familyName}`,
      picture: profile.photos[0].value
    };
    const storedTokens = {
      _id: profile.id,
      accessToken,
      expiryDate: Date.now() + 3600 * 1000,
      profile: userProfile
    };

    if (refreshToken || existingTokens?.refreshToken) {
      storedTokens.refreshToken = refreshToken || existingTokens.refreshToken;
    }

    await userTokensCollection.updateOne(
      { _id: profile.id },
      { $set: storedTokens },
      { upsert: true }
    );

    return done(null, userProfile);
  } catch (error) {
    return done(error);
  }
}));

// Auth routes
app.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.send'],
    accessType: 'offline',
    prompt: 'consent'
  })
);

app.get('/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: FRONTEND_ORIGIN ? `${FRONTEND_ORIGIN}/login` : '/login'
  }),
  (req, res) => {
    res.redirect(FRONTEND_ORIGIN || '/');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.json({ status: 'OK' });
  });
});

// AI function to parse prompt and extract email details using Gemini AI
async function parseEmailPrompt(prompt) {
  // If Gemini AI is not configured, fall back to the mock parser
  if (!geminiModel) {
    console.warn('Gemini API not configured, falling back to mock parser');
    return parseEmailPromptMock(prompt);
  }

  try {
    // Get current date/time for context
    const currentDate = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const currentDateTime = currentDate.toISOString();

    const aiPrompt = `
      You are an AI email scheduling assistant.

      Your task is to understand the user's natural-language request and return one JSON object for each separate email the user asks to send.

      The user is describing an EMAIL they want to send. You must determine:

      1. Who the email should be sent to.
      2. What the email should say.
      3. What the email subject should be.
      4. WHEN the email itself should be sent.

      IMPORTANT:
      A time mentioned inside the email content is NOT necessarily the email's send time.

      For example:

      "Send an email to [john@example.com](mailto:john@example.com) at 10:27 PM saying let's meet at 9 AM tomorrow."

      means:

      * Email send time = 10:27 PM today
      * Email body = "Let's meet at 9 AM tomorrow."
      * 9 AM tomorrow = information contained INSIDE the email
      * 9 AM tomorrow is NOT the email send time.

      ---

      OUTPUT FORMAT

      Return ONLY a valid JSON array:

      [
        {
          "to": ["recipient1@example.com"],
          "subject": "generated subject",
          "body": "email body",
          "sendTime": "ISO-8601 datetime"
        }
      ]

      Do not return Markdown.
      Do not return json.
      Do not return explanations.
      Do not return any text outside the JSON object.

      ---

      RECIPIENT RULES

      Extract ALL recipient email addresses mentioned in the prompt.
      Return them as an array of plain email-address strings in the "to" field.
      For Markdown mailto links, return only the address, without Markdown or a mailto: prefix.
      If no recipient email address is present, return an empty array.
      Put multiple recipients in one object only when they are recipients of the same email. Separate independently requested emails into separate array objects, even when they appear in the same prompt.

      ---

      SEND TIME RULES

      Find the time at which the USER WANTS THE EMAIL TO BE SENT.

      Look specifically for phrases such as:

      "send at 10 PM"
      "send it at 7:30 PM"
      "at 10:27 PM"
      "send tomorrow at 9 AM"
      "send this in 30 minutes"

      Do NOT confuse a time mentioned in the email body with the email's send time.

      Example:

      "Send an email at 10:27 PM saying let's have a meeting at 9 AM tomorrow."

      sendTime = 10:27 PM

      The 9 AM time belongs to the email body.

      Resolve:

      "today"
      "tomorrow"
      "tonight"
      "this evening"
      "in 30 minutes"
      "in 2 hours"

      using the current date/time provided below:
      Current date/time: ${currentDateTime}
      User timezone: ${timezone}

      If the email send time is not explicitly specified or cannot be determined, use current time + 1 minute.

      Return sendTime as an ISO-8601 datetime in UTC (ending with 'Z').

      ---

      SUBJECT RULES

      If the user explicitly gives a subject, use it.

      Otherwise, GENERATE a concise subject based on the actual purpose of the email.

      Do NOT use the user's entire prompt as the subject.

      Do NOT use:

      "Send an email to..."
      "Email..."
      "Hey Send an email..."

      Examples:

      User:
      "Send Rahul an email saying I'll be late to the meeting."

      Subject:
      "Running Late to the Meeting"

      User:
      "Send Sarah an email saying let's discuss the project tomorrow."

      Subject:
      "Project Discussion"

      User:
      "Send Arsh an email saying let's fix a meeting at 9 AM tomorrow."

      Subject:
      "Meeting at 9 AM Tomorrow"

      ---

      BODY RULES

      Extract the actual message the user wants to communicate.

      Remove command/instruction language such as:

      "Send an email to..."
      "Email..."
      "Send this to..."
      "at 10 PM..."
      "send it tomorrow..."

      These are instructions to the AI, NOT part of the email body.

      For example:

      User:
      "Send an email to [arsh@example.com](mailto:arsh@example.com) at 10:27 PM saying hey lets fix a meeting at 9 AM tomorrow."

      The body should be approximately:

      "Hey, let's fix a meeting at 9 AM tomorrow."

      NOT:

      "Send an email to [arsh@example.com](mailto:arsh@example.com) at 10:27 PM saying hey lets fix a meeting at 9 AM tomorrow."

      Do not include the email recipient, send time, or scheduling instructions in the body unless the user explicitly wants them included.

      Preserve the user's intended meaning.

      You may fix obvious spelling or punctuation mistakes when generating the email body.

      For example:

      "tommorow" → "tomorrow"

      "lets" → "let's"

      But do not change the meaning.

      ---

      CURRENT CONTEXT


      Current date/time: ${currentDateTime}
      User timezone: ${timezone}

      ---

      USER REQUEST

      ${prompt}

      ---

      FINAL INSTRUCTION

      Understand the request semantically before producing the JSON. And when someone says send a mail to someone without mentioning the time push the mail directly.

      Separate:

      EMAIL SEND TIME

      from:

      TIMES/DATES MENTIONED INSIDE THE EMAIL BODY.

      Then return ONLY the JSON array, with one object per independently requested email.


    `;

    const result = await geminiModel.generateContent(aiPrompt);
    const response = await result.response;
    const text = response.text();

    // Try to parse the JSON response
    let emailRequests;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      const parsedResponse = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      emailRequests = Array.isArray(parsedResponse) ? parsedResponse : [parsedResponse];
      if (emailRequests.length === 0 || emailRequests.some(request => !request || typeof request !== 'object' || Array.isArray(request))) {
        throw new Error('Gemini returned no valid email requests');
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', parseError);
      throw new Error('Gemini returned an unreadable response. No email was scheduled.');
    }

    const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
    return emailRequests.map(emailDetails => {
      const recipientValues = Array.isArray(emailDetails.to) ? emailDetails.to : [emailDetails.to];
      const to = recipientValues
        .filter(value => typeof value === 'string')
        .flatMap(value => value.match(emailPattern) || []);

      if (to.length === 0) {
        throw new Error('Gemini did not identify a valid recipient email address. No email was scheduled.');
      }

      const uniqueRecipients = [...new Set(to)].sort((a, b) => a.localeCompare(b));
      const subject = typeof emailDetails.subject === 'string' && emailDetails.subject.trim()
        ? emailDetails.subject.trim()
        : 'No Subject';
      const body = typeof emailDetails.body === 'string' && emailDetails.body.trim()
        ? emailDetails.body.trim()
        : prompt;

      let sendTime = new Date(Date.now() + 60_000);
      if (emailDetails.sendTime) {
        const parsedTime = new Date(emailDetails.sendTime);
        if (Number.isNaN(parsedTime.getTime())) {
          throw new Error('Gemini did not provide a valid send time. No email was scheduled.');
        }
        sendTime = parsedTime;
      }

      if (sendTime <= new Date()) {
        sendTime.setDate(sendTime.getDate() + 1);
      }

      return { to: uniqueRecipients, subject, body, sendTime };
    });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    if (error.message?.includes('No email was scheduled.')) {
      error.statusCode = 422;
      throw error;
    }
    const parseError = new Error('Gemini could not process this prompt. No email was scheduled.');
    parseError.statusCode = 502;
    throw parseError;
  }
}

// Mock AI function to parse prompt and extract email details (fallback)
function parseEmailPromptMock(prompt) {
  const requestPattern = /\b(?:and\s+)?send\s+(?:an?\s+)?(?:mail|email)\s+to\b/gi;
  const requestStarts = [...prompt.matchAll(requestPattern)];
  const requests = requestStarts.length > 1
    ? requestStarts.map((request, index) => {
      const start = request.index;
      const end = requestStarts[index + 1]?.index ?? prompt.length;
      return prompt.slice(start, end).replace(/^\s*and\s+/i, '').trim();
    })
    : [prompt];

  return requests.map(parseSingleEmailPromptMock);
}

function parseSingleEmailPromptMock(prompt) {

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = prompt.match(emailRegex) || [];

  // Sort emails alphabetically and remove duplicates
  const sortedEmails = [...new Set(emails)].sort((a, b) => a.localeCompare(b));

  // Extract subject (look for "subject" keyword)
  let subject = 'No Subject';
  const subjectMatch = prompt.match(/subject['"]?\s*[:=]?\s*['"]?([^'"]*['"])?/i);
  if (subjectMatch && subjectMatch[1]) {
    subject = subjectMatch[1].replace(/['"]/g, '');
  }

  // Extract body (look for "body" keyword or use remaining text)
  let body = prompt;
  const bodyMatch = prompt.match(/body['"]?\s*[:=]?\s*['"]?([^'"]*['"])?/i);
  const sayingMatch = prompt.match(/\bsaying\s+([\s\S]*)$/i);
  if (bodyMatch && bodyMatch[1]) {
    body = bodyMatch[1].replace(/['"]/g, '');
  } else if (sayingMatch) {
    body = sayingMatch[1].trim().replace(/^['"]|['"]$/g, '');
  }

  // Extract time (simplified) - treat as UTC
  let sendTime = new Date(); // Default to now
  const timeMatch = prompt.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const isPM = timeMatch[3].toLowerCase() === 'pm';

    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    // Get current UTC date/time
   const now = new Date();

    // Build today's date at the given LOCAL time
    let sendTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(hours),
      Number(minutes),
      0,
      0
    );

    // If that time has already passed, schedule for tomorrow
    if (sendTime <= now) {
      sendTime.setDate(sendTime.getDate() + 1);
    }

    // Send to the server/API in UTC if needed
    const sendTimeISO = sendTime.toISOString();
  }

  // If no emails found, use a generic placeholder that makes it clear this needs to be replaced
  const fallbackTo = sortedEmails.length > 0 ? sortedEmails : ['please-specify-recipients@example.com'];

  return {
    to: fallbackTo,
    subject,
    body,
    sendTime
  };
}

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

// Function to get Gmail instance for a user
async function getGmailInstance(userId) {
  await mongoClientPromise;
  const userTokensCollection = mongoClient.db().collection('userTokens');
  const tokens = await userTokensCollection.findOne({ _id: userId });
  if (!tokens) {
    throw new Error('No stored OAuth tokens for user; sign in with Google again');
  }
  if (!tokens.refreshToken) {
    throw new Error('No refresh token stored for user; sign in with Google again');
  }

  console.log(
    `OAuth token estimate: ${Math.max(0, Math.ceil((tokens.expiryDate - Date.now()) / 60_000))} minutes remaining`
  );

  // Check if token is expired and refresh if needed
  if (Date.now() >= tokens.expiryDate) {
    // In a real implementation, you would refresh the token here
    // For this demo, we'll just use what we have
    console.log('Token expired - would refresh in real implementation');
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BASE_URL || 'http://localhost:3001'}/auth/google/callback`
  );

  auth.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate
  });

  auth.on('tokens', refreshedTokens => {
    const updates = {};
    if (refreshedTokens.access_token) updates.accessToken = refreshedTokens.access_token;
    if (refreshedTokens.expiry_date) updates.expiryDate = refreshedTokens.expiry_date;
    if (refreshedTokens.refresh_token) updates.refreshToken = refreshedTokens.refresh_token;
    if (Object.keys(updates).length > 0) {
      userTokensCollection.updateOne({ _id: userId }, { $set: updates })
        .catch(error => console.error('Failed to persist refreshed Gmail tokens:', error));
    }
  });

  return {
    gmail: google.gmail({ version: 'v1', auth }),
    userProfile: tokens.profile
  };
}

// Route to handle email scheduling
app.post('/api/send-email', ensureAuthenticated, async (req, res) => {
  try {
    const { prompt } = req.body;
    const userId = req.user.id;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    // Process the email request through our three agents
    const result = await OrchestratorAgent.processEmailRequest(userId, prompt);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: result.message,
      emailId: result.recordId,
      emailIds: result.recordIds,
      emails: result.emails,
      nextSendTime: result.nextSendTime
    });
  } catch (error) {
    console.error('Error scheduling email:', error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Failed to schedule email'
    });
  }
});

// Function to send email using Gmail API
async function sendEmailViaGmail(userId, emailDetails) {
  try {
    const { gmail, userProfile } = await getGmailInstance(userId);

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    const emailLines = [
      `From: ${userProfile.name} <${userProfile.email}>`,
      `To: ${Array.isArray(emailDetails.to) ? emailDetails.to.join(', ') : emailDetails.to}`,
      `Subject: ${emailDetails.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      emailDetails.body
    ];

    const email = emailLines.join('\r\n').trim();
    const base64EncodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: base64EncodedEmail
      }
    });

    console.log('=== EMAIL SENT VIA GMAIL API ===');
    console.log('To:', Array.isArray(emailDetails.to) ? emailDetails.to.join(', ') : emailDetails.to);
    console.log('Subject:', emailDetails.subject);
    console.log('Message ID:', response.data.id);
    console.log('=================================');

    return response.data;
  } catch (error) {
    console.error('Error sending email via Gmail API:', error);
    throw error;
  }
}

// Function to send due emails (runs every minute)
async function sendDueEmails() {
  await mongoClientPromise;
  if (!scheduledEmailsCollection) {
    db = mongoClient.db();
    scheduledEmailsCollection = db.collection('scheduledEmails');
  }

  try {
    const now = new Date();
    const dueEmails = await scheduledEmailsCollection
      .find(getScheduledEmailQuery({ $lte: now }))
      .toArray();
    dueEmails.sort(compareScheduledEmails);
    let sent = 0;
    let failed = 0;

    for (const emailRecord of dueEmails) {
      try {
        const userId = emailRecord.userId;
        const emailDetails = getScheduledEmailDetails(emailRecord);

        await sendEmailViaGmail(userId, emailDetails);
        // Remove the email record after sending
        await OrchestratorAgent.removeEmailRecord(emailRecord._id.toString());
        sent += 1;
        console.log(`Sent email ${emailRecord._id} to ${emailDetails.to}`);
      } catch (error) {
        failed += 1;
        console.error(`Error sending email ${emailRecord._id}:`, error);
        // We leave the email in the database so it will be retried next minute
      }
    }
    return { due: dueEmails.length, sent, failed };
  } catch (error) {
    console.error('Error in sendDueEmails:', error);
    throw error;
  }
}

if (process.env.VERCEL !== '1') {
  cron.schedule('* * * * *', () => {
    sendDueEmails().catch(error => console.error('Scheduled email check failed:', error));
  });
}

app.get('/api/cron/send-due-emails', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET is not configured' });
  }
  if (req.get('authorization') !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await sendDueEmails();
    return res.json({ status: 'ok', ...result });
  } catch (error) {
    console.error('Cron email delivery failed:', error);
    return res.status(500).json({ error: 'Failed to process due emails' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    authenticated: req.isAuthenticated() ? req.user : null
  });
});

// Get next scheduled email for user
app.get('/api/next-email', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const nextEmail = await OrchestratorAgent.getNextScheduledEmail(userId);

    if (!nextEmail) {
      return res.json({
        message: 'No scheduled emails found',
        nextEmail: null
      });
    }

    res.json({
      nextEmail: {
        id: nextEmail._id.toString(),
        subject: getScheduledEmailDetails(nextEmail).subject,
        sendTime: getScheduledEmailTime(nextEmail),
        recipients: getScheduledEmailDetails(nextEmail).to
      }
    });
  } catch (error) {
    console.error('Error getting next email:', error);
    res.status(500).json({ error: 'Failed to get next email' });
  }
});

// Get all scheduled emails for user (sorted by time)
app.get('/api/scheduled-emails', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const emails = await OrchestratorAgent.getUserScheduledEmails(userId);

    res.json({
      scheduledEmails: emails.map(email => ({
        id: email._id.toString(),
        subject: getScheduledEmailDetails(email).subject,
        sendTime: getScheduledEmailTime(email),
        recipients: getScheduledEmailDetails(email).to
      })),
      count: emails.length
    });
  } catch (error) {
    console.error('Error getting scheduled emails:', error);
    res.status(500).json({ error: 'Failed to get scheduled emails' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`OAuth callback URL: ${process.env.BASE_URL || 'http://localhost:3001'}/auth/google/callback`);
});