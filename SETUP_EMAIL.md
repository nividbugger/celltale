# Email Setup Guide – CellTale Diagnostics

## Overview
Emails are sent via **Gmail OAuth2** using Firebase Cloud Functions (Node 18, region: `asia-south1`).

---

## Step 1 – Enable the Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com) and select the project linked to your Firebase app (`celltalediagnostics-8f817`).
2. Navigate to **APIs & Services → Library**.
3. Search for **Gmail API** and click **Enable**.

---

## Step 2 – Create an OAuth 2.0 Client ID

1. In Google Cloud Console go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials → OAuth client ID**.
3. Application type: **Web application**.
4. Name it something like `CellTale Email Sender`.
5. Under **Authorized redirect URIs** add:
   ```
   https://developers.google.com/oauthplayground
   ```
6. Click **Create**. Note down the **Client ID** and **Client Secret**.

---

## Step 3 – Get a Refresh Token via OAuth Playground

1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Click the ⚙ gear icon (top-right) → check **"Use your own OAuth credentials"**.
3. Enter your **Client ID** and **Client Secret** from Step 2.
4. In the left panel, paste this scope and click **Authorize APIs**:
   ```
   https://mail.google.com/
   ```
5. Sign in as `sruthi_kandaswamy@celltalediagnostics.com` and allow access.
6. Click **Exchange authorization code for tokens**.
7. Copy the **Refresh token** value.

---

## Step 4 – Configure Environment Variables

### Local Development
Copy `.env.example` to `.env` inside the `functions/` directory and fill in your credentials:

```bash
cp functions/.env.example functions/.env
```

Edit `functions/.env`:
```
GMAIL_USER=sruthi_kandaswamy@celltalediagnostics.com
GMAIL_CLIENT_ID=<from Step 2>
GMAIL_CLIENT_SECRET=<from Step 2>
GMAIL_REFRESH_TOKEN=<from Step 3>
APP_URL=http://localhost:5173
```

### Production Deployment
Store secrets securely using Firebase Secret Manager (recommended) or runtime env vars:

```bash
# Set each secret
firebase functions:secrets:set GMAIL_CLIENT_ID
firebase functions:secrets:set GMAIL_CLIENT_SECRET
firebase functions:secrets:set GMAIL_REFRESH_TOKEN

# Set non-secret runtime vars
firebase functions:config:set app.url="https://celltalediagnostics-8f817.web.app"
```

Alternatively, set them as environment variables in the Firebase Console:
**Project Settings → Functions → (your function) → Edit → Environment variables**

---

## Step 5 – Install Dependencies & Deploy

```bash
cd functions
npm install

# Build TypeScript
npm run build

# Deploy to Firebase
firebase deploy --only functions
```

---

## Step 6 – Configure the Reminder Time (optional)

The reminder email defaults to `4 hours before` the appointment.
To change it, create or update this Firestore document:

```
Collection: config
Document:   emailSettings
Fields:
  reminderHoursBefore: 4   ← change to any number (e.g., 2, 6, 24)
```

You can do this directly in the Firestore console.

---

## Email Triggers Summary

| Trigger | When | Email Sent |
|---------|------|------------|
| `onUserCreated` | New patient registers | Welcome email |
| `onAppointmentCreated` | Patient books a test | Booking confirmation |
| `onAppointmentUpdated` | Status → Confirmed | Appointment confirmed |
| `onAppointmentUpdated` | Status → Sample Collected | Sample collected notification |
| `onAppointmentUpdated` | Status → Report Ready | Report ready notification |
| `sendReminders` | Every hour (IST) | Reminder X hours before appointment |

---

## WhatsApp (Future Integration)
The same trigger architecture is ready for WhatsApp. When integrating Twilio/WATI/any other provider, add a `sendWhatsApp()` helper alongside `sendEmail()` and call it from the same trigger functions.
