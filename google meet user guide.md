🏗️ OVERVIEW (What We Are Building)
Your Internal Tool Backend
        ↓
Service Account (Google Cloud)
        ↓
Shared Google Calendar (normal Gmail account)
        ↓
Auto Google Meet Link Generated
✅ STEP 1 — Create a Dedicated Gmail Account

Create a normal Google account:

niolla.meetings@gmail.com

This account will own the calendar.

👉 Do NOT use your personal email.

✅ STEP 2 — Create a Calendar
Open:

👉 https://calendar.google.com/

Logged in as:
niolla.meetings@gmail.com

Create new calendar:

Click "+" next to "Other calendars"

Create new calendar

Name it:

Niolla Meetings
🔎 Copy Calendar ID

Go to:

Settings → "Niolla Meetings" → Integrate Calendar

Copy:

Calendar ID

It will look like:

xxxxxxxxxx@group.calendar.google.com

Save this. You’ll need it.

✅ STEP 3 — Create Google Cloud Project

Go to:

👉 https://console.cloud.google.com/

Create New Project
Name: Niolla Meet Bot

Select that project

✅ STEP 4 — Enable Google Calendar API

Go to:

APIs & Services → Library

Search:

Google Calendar API

Click → Enable

✅ STEP 5 — Create Service Account

Go to:

APIs & Services → Credentials
Click:

➕ Create Credentials → Service Account

Fill:

Name:

niolla-calendar-bot

Click Create → Continue → Done

✅ STEP 6 — Generate JSON Key

Open the service account you created.

Go to:
Keys → Add Key → Create new key → JSON

Download the file.

⚠️ Keep this file secret.
⚠️ Do NOT upload to GitHub.

✅ STEP 7 — Share Calendar with Service Account

Open Google Calendar again (logged into niolla.meetings@gmail.com
).

Go to:

Settings → Niolla Meetings → Share with specific people

Click:

Add people

Paste the service account email:

It looks like:

niolla-calendar-bot@your-project-id.iam.gserviceaccount.com

Give permission:

✅ "Make changes to events" (Editor)

Save.

🔥 This Step Is CRITICAL

If you skip this → it will NOT work.

✅ STEP 8 — Install Node.js Google Library

In your backend project:

npm install googleapis
✅ STEP 9 — Store Service Account Key

Option A (recommended):

Create folder:

/config/google-service.json

Place downloaded JSON file there.

✅ STEP 10 — Backend Code to Create Meeting

Here is production-safe minimal code:

const { google } = require("googleapis");
const path = require("path");

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "config/google-service.json"),
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

async function createMeeting() {
  const calendar = google.calendar({ version: "v3", auth });

  const event = {
    summary: "Niolla Internal Meeting",
    description: "Auto generated meeting",
    start: {
      dateTime: "2026-02-18T10:00:00+05:30",
      timeZone: "Asia/Colombo",
    },
    end: {
      dateTime: "2026-02-18T11:00:00+05:30",
      timeZone: "Asia/Colombo",
    },
    conferenceData: {
      createRequest: {
        requestId: Date.now().toString(), // MUST be unique
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const response = await calendar.events.insert({
    calendarId: "YOUR_CALENDAR_ID_HERE",
    resource: event,
    conferenceDataVersion: 1,
  });

  console.log("Meet Link:", response.data.hangoutLink);
  return response.data;
}

createMeeting();

Replace:

YOUR_CALENDAR_ID_HERE

with the Calendar ID you copied earlier.

✅ STEP 11 — Test It

Run:

node yourfile.js

If everything is correct, you’ll get:

Meet Link: https://meet.google.com/xxx-xxxx-xxx

🎉 Done.

🧠 What You Should Store in Database

When creating meetings from your internal tool, store:

google_event_id
meet_link
start_time
end_time
title

Because later you’ll need:

Update meeting

Delete meeting

Reschedule meeting