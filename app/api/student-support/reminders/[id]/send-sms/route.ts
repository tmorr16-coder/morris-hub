import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendSMSReminder, isValidPhoneNumber } from "@/lib/sms";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { id: reminderId } = await params;

  try {
    // Fetch reminder and verify ownership
    const { data: reminder, error: reminderError } = await service
      .schema("student_support")
      .from("reminders")
      .select("*, courses(user_id)")
      .eq("id", reminderId)
      .maybeSingle();

    if (reminderError || !reminder) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    // Verify course ownership
    if (reminder.courses?.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get user's phone number and SMS settings
    const { data: settings } = await service
      .schema("student_support")
      .from("student_settings")
      .select("phone_number, sms_notifications_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!settings?.phone_number) {
      return NextResponse.json(
        { error: "Phone number not configured in settings" },
        { status: 400 }
      );
    }

    if (!settings.sms_notifications_enabled) {
      return NextResponse.json(
        { error: "SMS notifications disabled in settings" },
        { status: 400 }
      );
    }

    if (!isValidPhoneNumber(settings.phone_number)) {
      return NextResponse.json(
        { error: "Invalid phone number in settings. Use format: +12125552368" },
        { status: 400 }
      );
    }

    // Send SMS
    const smsResult = await sendSMSReminder(
      settings.phone_number,
      reminder.title,
      reminder.due_date,
      reminder.due_time,
      reminder.description
    );

    if (!smsResult.success) {
      return NextResponse.json(
        { error: smsResult.error },
        { status: 500 }
      );
    }

    // Update reminder with sent timestamp
    const { error: updateError } = await service
      .schema("student_support")
      .from("reminders")
      .update({
        reminder_sent: true,
        sent_at: new Date().toISOString(),
      })
      .eq("id", reminderId);

    if (updateError) {
      console.error("Failed to update reminder sent status:", updateError);
      // Don't fail the response, SMS was already sent
    }

    return NextResponse.json({
      success: true,
      message: "SMS reminder sent successfully",
      messageId: smsResult.messageId,
    });
  } catch (err) {
    console.error("SMS send error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send SMS" },
      { status: 500 }
    );
  }
}
