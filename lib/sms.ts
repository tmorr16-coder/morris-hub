/**
 * SMS utilities using Twilio
 * Sends SMS reminders for course assignments and tests
 */

import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_FROM_PHONE;

if (!accountSid || !authToken || !fromPhone) {
  console.warn('Twilio SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_PHONE');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Validate phone number is in E.164 format
 * e.g., +12125552368
 */
export function isValidPhoneNumber(phone: string): boolean {
  return /^\+\d{10,15}$/.test(phone);
}

/**
 * Format phone number to E.164 format if possible
 * Handles US numbers like 2125552368 or (212) 555-2368
 */
export function formatPhoneNumber(phone: string): string | null {
  if (!phone) return null;

  // Remove non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If it already has +, validate it
  if (cleaned.startsWith('+')) {
    if (/^\+\d{10,15}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  // If no +, assume US and add +1
  if (/^\d{10}$/.test(cleaned)) {
    return '+1' + cleaned;
  }

  return null;
}

/**
 * Send SMS reminder to user
 */
export async function sendSMSReminder(
  toPhone: string,
  reminderTitle: string,
  dueDate: string,
  dueTime?: string,
  description?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!client || !fromPhone) {
    return {
      success: false,
      error: 'SMS service not configured',
    };
  }

  if (!isValidPhoneNumber(toPhone)) {
    return {
      success: false,
      error: 'Invalid phone number format. Use E.164 format (e.g., +12125552368)',
    };
  }

  try {
    const dateObj = new Date(dueDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    // Build SMS message
    let message = `📚 Reminder: ${reminderTitle}\n`;
    message += `Due: ${formattedDate}`;
    if (dueTime) {
      message += ` at ${dueTime}`;
    }
    if (description) {
      message += `\n${description}`;
    }

    // Send via Twilio
    const result = await client.messages.create({
      body: message,
      from: fromPhone,
      to: toPhone,
    });

    return {
      success: true,
      messageId: result.sid,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('SMS send error:', error);
    return {
      success: false,
      error: `Failed to send SMS: ${error}`,
    };
  }
}
