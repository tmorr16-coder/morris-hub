# 🚀 Student Support Enhancements - Deployment Checklist

**Status**: Code deployed to GitHub ✅  
**Vercel Deployment**: Auto-triggered (watch for completion)  
**Supabase**: Manual steps required  

---

## Phase 1: GitHub & Vercel (AUTO ✅)

### What Just Happened
```
✅ Pushed 4 commits to origin/main
✅ Vercel webhook triggered
✅ Auto-deployment started
```

### Commits Deployed
1. `67fd1fd` - Phases 1-3 implementation
2. `a0f0352` - Phase 4 + SMS settings  
3. `515da8e` - TypeScript fixes + dependencies
4. `7828e15` - Deployment summary

### Monitor Vercel Deployment
**Action**: Go to https://vercel.com/dashboard/projects/morris-hub

1. Watch for "Deployment in progress" notification
2. Wait for deployment to complete (~2-3 minutes)
3. Verify production build succeeded
4. Check for any errors in Deployment logs

**Expected**: Green checkmark with "Ready" status

---

## Phase 2: Supabase Migrations (MANUAL ⚠️)

### Step 1: Access Supabase
1. Go to https://supabase.com/dashboard/projects
2. Select your morris-hub project
3. Navigate to SQL Editor tab

### Step 2: Run 4 Migrations (IN ORDER)

#### Migration 1: Research Chat Tables
```sql
-- Copy entire contents of:
-- supabase/migrations/20260528_add_research_chat.sql
```
**File location**: See DEPLOYMENT_GUIDE.md for full SQL

**Steps**:
1. Open file in text editor
2. Copy all content
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Verify success message

#### Migration 2: Student Settings SMS
```sql
-- Copy entire contents of:
-- supabase/migrations/20260529_extend_student_settings.sql
```

#### Migration 3: Course Content Files
```sql
-- Copy entire contents of:
-- supabase/migrations/20260530_extend_course_content.sql
```

#### Migration 4: Storage Bucket
```sql
-- Copy entire contents of:
-- supabase/migrations/20260531_add_content_storage_bucket.sql
```

### Verify Migrations
After each migration, verify in Supabase:
1. Go to "Tables" tab in Supabase Dashboard
2. Check for new tables:
   - `research_chat_sessions`
   - `research_chat_messages`
3. Check column additions:
   - `student_settings`: phone_number, sms_notifications_enabled, reminder_lead_days
   - `course_content`: file_path, extracted_text, is_uploaded, file_size_kb
4. Check Storage:
   - New bucket: `student-support-content`

**Time**: ~15-20 minutes for all 4 migrations

---

## Phase 3: Vercel Environment Variables (MANUAL ⚠️)

### Step 1: Add Twilio Credentials
1. Go to https://vercel.com/dashboard
2. Select morris-hub project
3. Settings → Environment Variables
4. Add these variables:

| Variable | Value | Source |
|----------|-------|--------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxxxxxxxxxx` | https://console.twilio.com |
| `TWILIO_AUTH_TOKEN` | `your_auth_token_here` | https://console.twilio.com |
| `TWILIO_FROM_PHONE` | `+12125552368` | Phone Numbers section in Twilio |
| `CRON_SECRET` | `your_random_secret` | Generate with `openssl rand -base64 32` |

### Step 2: Update vercel.json (if needed)
1. Edit `vercel.json` in project root
2. Add cron job configuration:
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
3. Commit and push (auto-redeploy)

### Step 3: Redeploy
1. In Vercel, click "Redeploy" on latest deployment
2. Wait for deployment to complete with new env vars
3. Verify no errors in logs

**Time**: ~5-10 minutes

---

## Phase 4: Verify Production (MANUAL ⚠️)

### Quick Smoke Test
1. Go to https://morrisai.family (or your Vercel domain)
2. Log in with test account
3. Navigate to Student Support → Create/edit course
4. Try these actions:
   - [ ] Click "Research Chat" tab - should load without errors
   - [ ] Go to "Content" tab - upload a PDF or DOCX file
   - [ ] Go to "Reminders" tab - create a reminder and click "Send SMS" button
   - [ ] Go to Settings - scroll to "Course reminders (SMS)" - verify form displays

### Home Page Check
1. Navigate to home page
2. Check Reminders widget
3. Verify course reminders appear alongside hub reminders (if any exist)
4. Check reminders are sorted by due date

### Monitor Logs
1. Vercel: Check runtime logs for any errors
2. Twilio: Go to https://console.twilio.com to verify SMS sent (if you tested)
3. Supabase: Check Tables for new records in research_chat_messages, etc.

**Time**: ~10-15 minutes

---

## Timeline

| Phase | Component | Status | Approx Time |
|-------|-----------|--------|------------|
| 1 | GitHub Push | ✅ Complete | Done |
| 2 | Vercel Auto-Deploy | ⏳ In Progress | 2-3 min |
| 2 | Supabase Migrations | ⚠️ Manual | 15-20 min |
| 3 | Vercel Env Vars | ⚠️ Manual | 5-10 min |
| 3 | Redeploy Vercel | ⏳ Next | 2-3 min |
| 4 | Testing | ⚠️ Manual | 10-15 min |
| **TOTAL** | **Full Deployment** | | **35-60 min** |

---

## Troubleshooting During Deployment

### Vercel Deployment Failed
- **Check**: Vercel Deployment logs
- **Look for**: Build errors, missing dependencies
- **Fix**: Usually auto-redeployed on next push; verify dependencies installed

### Supabase Migration Error
- **Check**: SQL error message in Supabase
- **Common**: Syntax errors, missing tables (run in order!)
- **Fix**: Copy full migration file, paste into SQL Editor, run again

### SMS Not Sending
- **Check**: Twilio credentials in Vercel env vars
- **Common**: Wrong format (SID should start with AC), missing FROM_PHONE
- **Fix**: Verify credentials at https://console.twilio.com
- **Test**: Click "Send SMS" on reminder - check error message

### Cron Job Not Running
- **Check**: Vercel → Deployments → Cron Jobs tab
- **Common**: Not in vercel.json, wrong schedule format
- **Fix**: Verify vercel.json syntax, redeploy after updating

---

## After Deployment Complete ✅

1. **Monitor for 24 hours**
   - Watch Vercel logs for errors
   - Monitor Twilio dashboard for SMS costs/usage
   - Check Supabase for database performance

2. **Notify Users**
   - Let students know SMS reminders are available
   - Share instructions: use E.164 format (+12125552368)
   - Explain lead time configuration (1-7 days)

3. **Document Setup**
   - Save Twilio credentials securely
   - Document cron job schedule
   - Keep deployment notes for future reference

4. **Iterate**
   - Gather user feedback
   - Adjust SMS message templates if needed
   - Tune cron job timing if needed

---

## Support

For issues:
1. Check **DEPLOYMENT_GUIDE.md** - detailed troubleshooting section
2. Check **DEPLOYMENT_SUMMARY.md** - feature overview and status
3. Review Vercel/Supabase logs for specific error messages
4. Contact Twilio support if SMS issues: https://support.twilio.com

---

## Verification Checklist

### Code (✅ Complete)
- [x] All phases implemented (1-4)
- [x] TypeScript errors fixed
- [x] Dependencies installed
- [x] Build succeeds
- [x] Committed to GitHub

### Deployment (In Progress)
- [ ] Vercel auto-deployment complete
- [ ] Supabase migrations run (all 4)
- [ ] Vercel env vars configured
- [ ] Vercel redeployed with env vars
- [ ] Smoke tests pass
- [ ] Production working

### Post-Deployment
- [ ] Monitor for 24 hours
- [ ] Notify users
- [ ] Document setup
- [ ] Gather feedback

---

**Expected Completion Time**: 35-60 minutes from now  
**Status**: Ready to proceed with manual steps ✅
