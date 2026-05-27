import { createServiceClient } from "@/lib/supabase/server";
import { sendSMSReminder } from "@/lib/sms";
import { NextResponse } from "next/server";

/**
 * Cron job to send scheduled SMS reminders
 * This runs daily and sends SMS to users for reminders due within their lead time
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/send-reminders",
 *     "schedule": "0 8 * * *"  // 8 AM UTC daily
 *   }]
 * }
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel's cron service
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  try {
    // Get all reminders that need to be sent
    // Reminders qualify if:
    // 1. Not yet sent (reminder_sent = false)
    // 2. User has SMS enabled (sms_notifications_enabled = true)
    // 3. Due date is within the reminder lead time

    const { data: reminders, error: remindersError } = await service
      .schema("student_support")
      .from("reminders")
      .select(`
        id,
        title,
        due_date,
        due_time,
        description,
        courses(user_id),
        courses!inner(id)
      `)
      .eq("reminder_sent", false)
      .lte("due_date", new Date().toISOString().split("T")[0]);

    if (remindersError) {
      console.error("Error fetching reminders:", remindersError);
      return NextResponse.json(
        { error: "Failed to fetch reminders", details: remindersError.message },
        { status: 500 }
      );
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No reminders to send",
        count: 0,
      });
    }

    // Group reminders by user
    const remindersByUser = new Map<string, typeof reminders>();
    for (const reminder of reminders) {
      const userId = reminder.courses?.user_id;
      if (!userId) continue;

      if (!remindersByUser.has(userId)) {
        remindersByUser.set(userId, []);
      }
      remindersByUser.get(userId)!.push(reminder);
    }

    // Send SMS for each user
    const results = [];
    for (const [userId, userReminders] of remindersByUser.entries()) {
      // Get user's phone number and settings
      const { data: settings, error: settingsError } = await service
        .schema("student_support")
        .from("student_settings")
        .select("phone_number, sms_notifications_enabled, reminder_lead_days")
        .eq("user_id", userId)
        .maybeSingle();

      if (settingsError) {
        console.error(`Error fetching settings for user ${userId}:`, settingsError);
        results.push({
          userId,
          reminders: userReminders.length,
          sent: 0,
          error: "Failed to fetch user settings",
        });
        continue;
      }

      if (!settings?.phone_number || !settings.sms_notifications_enabled) {
        results.push({
          userId,
          reminders: userReminders.length,
          sent: 0,
          error: "Phone number not configured or SMS disabled",
        });
        continue;
      }

      // Check lead time
      const leadDays = settings.reminder_lead_days || 3;
      const leadTime = leadDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
      const now = new Date().getTime();
      const qualifyingReminders = userReminders.filter((r: any) => {
        const dueTime = new Date(r.due_date).getTime();
        return dueTime - now <= leadTime;
      });

      if (qualifyingReminders.length === 0) {
        results.push({
          userId,
          reminders: userReminders.length,
          sent: 0,
          error: "No reminders within lead time",
        });
        continue;
      }

      // Send SMS for each reminder
      let sentCount = 0;
      for (const reminder of qualifyingReminders) {
        const smsResult = await sendSMSReminder(
          settings.phone_number,
          reminder.title,
          reminder.due_date,
          reminder.due_time,
          reminder.description
        );

        if (smsResult.success) {
          sentCount++;

          // Update reminder as sent
          await service
            .schema("student_support")
            .from("reminders")
            .update({
              reminder_sent: true,
              sent_at: new Date().toISOString(),
            })
            .eq("id", reminder.id)
            .catch((err: unknown) => {
              console.error(`Failed to update reminder ${reminder.id}:`, err);
            });
        } else {
          console.error(`Failed to send SMS for reminder ${reminder.id}:`, smsResult.error);
        }
      }

      results.push({
        userId,
        reminders: qualifyingReminders.length,
        sent: sentCount,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Cron job completed",
      results,
      totalProcessed: reminders.length,
    });
  } catch (err) {
    console.error("Cron job error:", err);
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
