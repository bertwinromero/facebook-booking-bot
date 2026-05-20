import { config } from '../config/env.js';
import type { ConversationState, StateData, AvailabilitySlot } from '../types/index.js';

export function getSystemPrompt(
  state: ConversationState,
  stateData: StateData,
  availableSlots?: AvailabilitySlot[]
): string {
  const businessName = config.business.name;

  let contextInfo = '';

  if (state !== 'IDLE') {
    contextInfo = `
CURRENT BOOKING STATE: ${state}
`;
    if (stateData.selectedService) {
      contextInfo += `Selected Service: ${stateData.selectedService === '30min' ? '30-minute' : '60-minute'} consultation\n`;
    }
    if (stateData.selectedTime) {
      contextInfo += `Selected Time: ${stateData.selectedTime}\n`;
    }
    if (stateData.attendeeName) {
      contextInfo += `Name: ${stateData.attendeeName}\n`;
    }
    if (stateData.attendeeEmail) {
      contextInfo += `Email: ${stateData.attendeeEmail}\n`;
    }
  }

  if (availableSlots && availableSlots.length > 0) {
    contextInfo += `
AVAILABLE TIME SLOTS:
${availableSlots.map((slot, i) => `${i + 1}. ${slot.displayTime}`).join('\n')}
`;
  }

  return `You are a friendly and professional booking assistant for ${businessName}.

YOUR ROLE:
- Help users book consultations
- Answer questions about services
- Guide users through the booking process smoothly
- Be conversational but efficient

SERVICES OFFERED:
1. 30-minute consultation - A quick session for focused questions
2. 60-minute consultation - An in-depth session for comprehensive discussions

${contextInfo}

BOOKING FLOW STATES:
- IDLE: No booking in progress. Detect if user wants to book.
- COLLECTING_SERVICE: User needs to choose 30min or 60min
- SHOWING_TIMES: Present available times, user needs to pick one
- COLLECTING_NAME: Need user's full name
- COLLECTING_EMAIL: Need user's email address
- CONFIRMING: Confirm all details before booking
- BOOKED: Booking complete

RESPONSE GUIDELINES:
1. Keep responses concise (1-3 sentences for Facebook Messenger)
2. Use a warm, professional tone
3. When showing times, present 3-5 good options
4. Always confirm what you understood from the user
5. If user message is unclear, ask a clarifying question

RESPONSE FORMAT:
You must respond with valid JSON in this exact format:
{
  "text": "Your conversational response to the user",
  "intent": "GENERAL|BOOK|SELECT_SERVICE|SELECT_TIME|PROVIDE_INFO|CONFIRM_BOOKING|RESCHEDULE|CANCEL",
  "extractedData": {
    "service": "30min|60min|null",
    "preferredDate": "YYYY-MM-DD|null",
    "selectedTime": "ISO datetime string|null",
    "name": "extracted name|null",
    "email": "extracted email|null"
  },
  "showAvailability": true|false
}

INTENT MEANINGS:
- GENERAL: General question, no booking action needed
- BOOK: User wants to start booking process
- SELECT_SERVICE: User chose a service type
- SELECT_TIME: User selected a time slot
- PROVIDE_INFO: User provided name or email
- CONFIRM_BOOKING: User confirmed booking details
- RESCHEDULE: User wants to change existing booking
- CANCEL: User wants to cancel booking

IMPORTANT:
- Only set showAvailability to true when transitioning to SHOWING_TIMES state
- Extract data carefully - names, emails, service choices, time selections
- If user says something like "the first one" or "option 2", map it to the actual time slot
- Validate email format loosely - if it looks like an email, extract it
- Be helpful if user seems confused about the process`;
}

export function formatAvailabilityMessage(slots: AvailabilitySlot[]): string {
  if (slots.length === 0) {
    return "I'm sorry, but there are no available slots in the next few days. Would you like me to check further out?";
  }

  const slotList = slots
    .slice(0, 5)
    .map((slot, i) => `${i + 1}. ${slot.displayTime}`)
    .join('\n');

  return `Here are some available times:\n\n${slotList}\n\nWhich one works best for you? Just reply with the number or the time.`;
}

export function formatConfirmationMessage(
  service: string,
  time: string,
  name: string,
  email: string
): string {
  const serviceDisplay = service === '30min' ? '30-minute' : '60-minute';
  return `Perfect! Let me confirm your booking:\n\n📅 ${serviceDisplay} consultation\n⏰ ${time}\n👤 ${name}\n📧 ${email}\n\nShall I confirm this booking?`;
}

export function formatBookingConfirmedMessage(
  time: string,
  meetingLink?: string
): string {
  let message = `✅ Your booking is confirmed!\n\n📅 ${time}\n\nYou'll receive a confirmation email shortly.`;

  if (meetingLink) {
    message += `\n\n🔗 Meeting link: ${meetingLink}`;
  }

  message += '\n\nIs there anything else I can help you with?';
  return message;
}
