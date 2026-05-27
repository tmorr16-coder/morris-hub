# Student Support Enhancements - Deployment Guide

This guide covers the deployment of the student support module enhancements (Phases 1-4), including research chat, file uploads, SMS reminders, and hub integration.

## Prerequisites

- Access to Supabase project
- Twilio account with credentials
- Environment variables configured
- Node.js and npm installed

## Phase 1: Database Migrations

Run the following migrations in Supabase (in order):

### 1. Research Chat Tables
**File**: `supabase/migrations/20260528_add_research_chat.sql`

Creates:
- `student_support.research_chat_sessions` table (id, user_id, course_id, created_at, updated_at)
- `student_support.research_chat_messages` table (id, session_id, role, content, created_at)
- Indexes on session_id, course_id, user_id
- RLS policies for user isolation

**Steps**:
1. Copy the SQL from the file
2. Go to Supabase Dashboard → SQL Editor
3. Paste and execute the SQL

### 2. Student Settings Extension
**File**: `supabase/migrations/20260529_extend_student_settings.sql`

Adds to `student_support.student_settings`:
- `phone_number` (TEXT) - User's SMS phone number
- `reminder_enabled` (BOOLEAN) - Enable/disable SMS reminders
- `reminder_lead_days` (INT) - Days ahead to send reminder (1-7, default 3)
- `sms_notifications_enabled` (BOOLEAN) - Master SMS toggle
- `updated_at` trigger for timestamp updates

### 3. Course Content Extension
**File**: `supabase/migrations/20260530_extend_course_content.sql`

Adds to `student_support.course_content`:
- `file_path` (TEXT) - Path in Supabase Storage
- `extracted_text` (TEXT) - Extracted content from PDF/DOCX
- `is_uploaded` (BOOLEAN) - Distinguish user uploads from links
- `file_size_kb` (INTEGER) - Track upload sizes
- Indexes for efficient querying

### 4. Content Storage Bucket
**File**: `supabase/migrations/20260531_add_content_storage_bucket.sql`

Creates:
- `student-support-content` Supabase Storage bucket (private)
- RLS policies for user-based access control
- Path structure: `user_id/course_id/filename`

**Steps**:
1. Run the SQL migration
2. Verify bucket appears in Supabase Storage tab

## Phase 2: Environment Variables

Add the following to your `.env.local`:

### Twilio SMS Configuration
```env
# Twilio account credentials
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_PHONE=+1234567890  # Your Twilio phone number in E.164 format

# Vercel Cron Job Secret
CRON_SECRET=your_random_secret_key_here
```

**How to find Twilio credentials**:
1. Log in to Twilio Console (https://console.twilio.com)
2. Account SID and Auth Token are on the dashboard
3. Phone Numbers section shows your "From" number

**Generate CRON_SECRET**:
```bash
# Generate a random secret
openssl rand -base64 32
```

## Phase 3: Package Dependencies

Verify dependencies are installed:

```bash
npm list twilio pdf-parse mammoth
```

If missing, they were added in the commit:
- `twilio`: ^4.10.0 - SMS sending
- `pdf-parse`: ^1.1.1 - PDF text extraction
- `mammoth`: ^1.8.0 - DOCX text extraction

## Phase 4: Vercel Configuration (Cron Jobs)

For scheduled SMS reminders, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

This runs the cron job daily at 8 AM UTC. Adjust the schedule as needed.

## Testing Checklist

### Research Chat (Phase 1)
- [ ] Navigate to student support course detail page
- [ ] Click "Research Chat" tab
- [ ] Type a question about course material
- [ ] Verify question saves to database
- [ ] Ask follow-up question
- [ ] Verify conversation history loads on page refresh

### File Upload (Phase 2)
- [ ] Go to course detail → Content tab
- [ ] Upload a PDF or DOCX file
- [ ] Verify file appears in content list with 📄 icon
- [ ] Check that text was extracted (preview shows text content)
- [ ] Upload multiple file types (PDF, DOCX, TXT)
- [ ] Ask research chat question about uploaded content
- [ ] Verify Claude references the uploaded material

### SMS Reminders (Phase 3)
- [ ] Go to Settings → "Course reminders (SMS)"
- [ ] Enter phone number in E.164 format (+12125552368)
- [ ] Enable SMS notifications
- [ ] Set lead time to 1 day
- [ ] Create a course reminder due tomorrow
- [ ] Click "Send SMS" button on reminder
- [ ] Verify SMS received on phone within 30 seconds
- [ ] Check that `reminder_sent` timestamp updated in database
- [ ] Wait for scheduled cron (8 AM UTC) or manually test `/api/cron/send-reminders`
- [ ] Verify batch SMS sent for qualifying reminders

### Hub Integration (Phase 4)
- [ ] Create course reminders due within 30 days
- [ ] Navigate to home page
- [ ] Verify course reminders appear in Reminders widget with course name
- [ ] Verify course reminders sort by due date alongside hub reminders
- [ ] Check that reminder icon/color is based on reminder type

### Settings Form (Phase 3)
- [ ] Navigate to /home/settings
- [ ] Verify SMS section displays with all fields
- [ ] Enter phone number and save
- [ ] Refresh page and verify settings persisted
- [ ] Toggle SMS enable/disable
- [ ] Adjust lead time slider (1-7 days)
- [ ] Verify form validation works (rejects invalid phone formats)

## Troubleshooting

### SMS Not Sending
1. Check Twilio credentials in `.env.local`
2. Verify phone number is in E.164 format (+1234567890)
3. Check that `sms_notifications_enabled = true` in student_settings
4. Review console logs for Twilio API errors
5. Verify Twilio account has available credits

### Files Not Uploading
1. Check Supabase Storage bucket exists and is accessible
2. Verify RLS policies allow your user to write
3. Check browser console for file upload errors
4. Ensure file size < 10MB
5. Verify Content-Type headers match file type

### Chat Not Persisting
1. Check `research_chat_sessions` table has records
2. Verify `research_chat_messages` table is storing messages
3. Check RLS policies on chat tables
4. Review API response in browser Network tab

### Cron Job Not Running
1. Verify `vercel.json` has the cron configuration
2. Check Vercel deployment logs for cron execution
3. Ensure `CRON_SECRET` env var matches Bearer token in route
4. Review `/api/cron/send-reminders` logs for errors

## Deployment Steps

1. **Commit and push all changes**:
   ```bash
   git add .
   git commit -m "Add student support enhancements: research chat, uploads, SMS"
   git push origin main
   ```

2. **Run Supabase migrations**:
   - Execute all 4 migrations in Supabase SQL Editor (in order)
   - Verify tables and columns are created

3. **Configure environment variables**:
   - Add Twilio credentials to `.env.local` (local testing)
   - Add to Vercel environment variables (production)
   - Add `CRON_SECRET` for scheduled jobs

4. **Update vercel.json**:
   - Add cron job configuration if not already present

5. **Test locally**:
   - Run `npm run dev`
   - Run through all testing checklist items
   - Fix any issues before deployment

6. **Deploy to Vercel**:
   - Push to `main` branch
   - Vercel will automatically deploy
   - Monitor deployment logs for errors
   - Verify cron job appears in Vercel Cron Jobs page

7. **Monitor production**:
   - Check error logs for SMS failures
   - Monitor Twilio usage dashboard
   - Verify cron job runs daily at scheduled time
   - Monitor Supabase Storage usage

## File Locations

### API Endpoints
- `/app/api/student-support/research-chat/route.ts` - Multi-turn chat
- `/app/api/student-support/content/upload/route.ts` - File upload
- `/app/api/student-support/reminders/[id]/send-sms/route.ts` - Manual SMS
- `/app/api/cron/send-reminders/route.ts` - Scheduled SMS job

### Components
- `app/home/student-support/courses/[courseId]/_components/ResearchChat.tsx`
- `app/home/student-support/courses/[courseId]/_components/ContentTab.tsx`
- `app/home/student-support/courses/[courseId]/_components/RemindersTab.tsx`
- `app/home/settings/_components/SettingsForm.tsx`

### Utilities
- `lib/sms.ts` - Twilio integration
- `lib/file-extraction.ts` - PDF/DOCX text extraction
- `lib/reminders.ts` - Reminder utility functions (updated with course reminder sync)

### Migrations
- `supabase/migrations/20260528_add_research_chat.sql`
- `supabase/migrations/20260529_extend_student_settings.sql`
- `supabase/migrations/20260530_extend_course_content.sql`
- `supabase/migrations/20260531_add_content_storage_bucket.sql`

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase and Twilio logs
3. Check browser console for client-side errors
4. Review `/api/cron/send-reminders` output for batch SMS issues
