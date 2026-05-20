import type { FacebookMessaging, ConversationState, StateData, AvailabilitySlot } from '../types/index.js';
import * as db from '../db/client.js';
import * as ai from '../services/ai.service.js';
import * as calendar from '../services/calendar.service.js';
import * as facebook from '../services/facebook.service.js';
import {
  formatAvailabilityMessage,
  formatConfirmationMessage,
  formatBookingConfirmedMessage,
} from '../prompts/booking-assistant.js';

export async function handleMessage(event: FacebookMessaging): Promise<void> {
  const senderId = event.sender.id;
  const messageText = event.message?.text;
  const quickReplyPayload = event.message?.quick_reply?.payload;
  const postbackPayload = event.postback?.payload;

  // Handle non-text messages
  if (!messageText && !quickReplyPayload && !postbackPayload) {
    if (event.message?.attachments) {
      await facebook.sendTextMessage(
        senderId,
        "Thanks for the attachment! I can only process text messages at the moment. How can I help you today?"
      );
    }
    return;
  }

  // Show typing indicator
  await facebook.markSeen(senderId);
  await facebook.typingOn(senderId);

  try {
    // Get or create conversation
    const conversation = await db.getOrCreateConversation(senderId);
    const state = conversation.state as ConversationState;
    const stateData = conversation.state_data as StateData;

    // Get conversation history
    const history = await db.getRecentMessages(conversation.id, 10);

    // Determine the input to process
    const userInput = quickReplyPayload || postbackPayload || messageText || '';

    // Handle quick reply payloads
    if (quickReplyPayload || postbackPayload) {
      await handlePayload(
        senderId,
        conversation.id,
        quickReplyPayload || postbackPayload || '',
        state,
        stateData
      );
      return;
    }

    // Save user message
    await db.saveMessage(conversation.id, 'user', userInput);

    // Get available slots if needed
    let availableSlots: AvailabilitySlot[] | undefined;
    if (state === 'SHOWING_TIMES' && stateData.availableSlots) {
      availableSlots = stateData.availableSlots;
    }

    // Generate AI response
    const aiResponse = await ai.generateResponse(
      userInput,
      history,
      state,
      stateData,
      availableSlots
    );

    // Process based on intent and state
    await processIntent(
      senderId,
      conversation.id,
      state,
      stateData,
      aiResponse,
      userInput
    );
  } catch (error) {
    console.error('Error handling message:', error);
    await facebook.sendTextMessage(
      senderId,
      "I'm sorry, something went wrong. Please try again in a moment."
    );
  } finally {
    await facebook.typingOff(senderId);
  }
}

async function handlePayload(
  senderId: string,
  conversationId: string,
  payload: string,
  state: ConversationState,
  stateData: StateData
): Promise<void> {
  switch (payload) {
    case 'SERVICE_30MIN':
      await handleServiceSelection(senderId, conversationId, '30min', stateData);
      break;

    case 'SERVICE_60MIN':
      await handleServiceSelection(senderId, conversationId, '60min', stateData);
      break;

    case 'CONFIRM_YES':
      await handleBookingConfirmation(senderId, conversationId, stateData);
      break;

    case 'CONFIRM_NO':
      await db.resetConversation(conversationId);
      await facebook.sendTextMessage(
        senderId,
        "No problem! Let's start over. Would you like to book a demo or discovery call?"
      );
      break;

    case 'GET_STARTED':
      await facebook.sendTextMessage(
        senderId,
        "Hi there! I'm here to help you book a demo or discovery call. Would you like to schedule one?"
      );
      break;

    default:
      // Unknown payload, treat as regular message
      break;
  }
}

async function processIntent(
  senderId: string,
  conversationId: string,
  state: ConversationState,
  stateData: StateData,
  aiResponse: Awaited<ReturnType<typeof ai.generateResponse>>,
  userInput: string
): Promise<void> {
  const { intent, extractedData, showAvailability } = aiResponse;

  // Save assistant response
  await db.saveMessage(conversationId, 'assistant', aiResponse.text, intent);

  switch (intent) {
    case 'BOOK':
      // User wants to book - ask for service type
      await db.updateConversationState(conversationId, 'COLLECTING_SERVICE', {});
      await facebook.sendQuickReplies(
        senderId,
        aiResponse.text,
        facebook.createServiceQuickReplies()
      );
      break;

    case 'SELECT_SERVICE':
      if (extractedData?.service) {
        await handleServiceSelection(
          senderId,
          conversationId,
          extractedData.service,
          stateData
        );
      } else {
        await facebook.sendQuickReplies(
          senderId,
          "Which would you like - a quick demo or a discovery call?",
          facebook.createServiceQuickReplies()
        );
      }
      break;

    case 'SELECT_TIME':
      if (state === 'SHOWING_TIMES' && stateData.availableSlots) {
        const selectedTime =
          extractedData?.selectedTime ||
          ai.mapSlotSelectionToTime(userInput, stateData.availableSlots);

        if (selectedTime) {
          await handleTimeSelection(
            senderId,
            conversationId,
            selectedTime,
            stateData
          );
        } else {
          await facebook.sendTextMessage(
            senderId,
            "I couldn't find that time slot. Could you please pick one from the list or tell me the number?"
          );
        }
      }
      break;

    case 'PROVIDE_INFO':
      await handleInfoProvided(
        senderId,
        conversationId,
        state,
        stateData,
        extractedData
      );
      break;

    case 'CONFIRM_BOOKING':
      await handleBookingConfirmation(senderId, conversationId, stateData);
      break;

    case 'CANCEL':
      await handleCancellation(senderId, conversationId);
      break;

    case 'RESCHEDULE':
      await handleReschedule(senderId, conversationId);
      break;

    case 'GENERAL':
    default:
      // Check if we should show availability based on state transition
      if (showAvailability || (state === 'COLLECTING_SERVICE' && extractedData?.service)) {
        const service = extractedData?.service || stateData.selectedService;
        if (service) {
          await handleServiceSelection(senderId, conversationId, service, stateData);
          return;
        }
      }

      // Default: just send the AI response
      await facebook.sendTextMessage(senderId, aiResponse.text);
      break;
  }
}

async function handleServiceSelection(
  senderId: string,
  conversationId: string,
  service: '30min' | '60min',
  _stateData: StateData
): Promise<void> {
  try {
    // Fetch availability
    const slots = await calendar.getAvailability(7);

    // Update state with service and available slots
    await db.updateConversationState(conversationId, 'SHOWING_TIMES', {
      selectedService: service,
      availableSlots: slots,
    });

    // Send availability message
    const message = formatAvailabilityMessage(slots);
    await facebook.sendTextMessage(senderId, message);
  } catch (error) {
    console.error('Error fetching availability:', error);
    await facebook.sendTextMessage(
      senderId,
      "I'm having trouble checking availability right now. Please try again in a moment."
    );
  }
}

async function handleTimeSelection(
  senderId: string,
  conversationId: string,
  selectedTime: string,
  stateData: StateData
): Promise<void> {
  await db.updateConversationState(conversationId, 'COLLECTING_NAME', {
    ...stateData,
    selectedTime,
    availableSlots: undefined, // Clear slots to save space
  });

  await facebook.sendTextMessage(
    senderId,
    `Great choice! I have you down for ${calendar.formatBookingTime(selectedTime)}.\n\nWhat's your full name?`
  );
}

async function handleInfoProvided(
  senderId: string,
  conversationId: string,
  state: ConversationState,
  stateData: StateData,
  extractedData?: { name?: string; email?: string }
): Promise<void> {
  const newStateData = { ...stateData };

  if (state === 'COLLECTING_NAME') {
    if (extractedData?.name) {
      newStateData.attendeeName = extractedData.name;
      await db.updateConversationState(conversationId, 'COLLECTING_EMAIL', newStateData);
      await facebook.sendTextMessage(
        senderId,
        `Thanks, ${extractedData.name}! What's your email address?`
      );
    } else {
      await facebook.sendTextMessage(
        senderId,
        "I didn't catch your name. Could you please tell me your full name?"
      );
    }
  } else if (state === 'COLLECTING_EMAIL') {
    if (extractedData?.email) {
      newStateData.attendeeEmail = extractedData.email;
      await db.updateConversationState(conversationId, 'CONFIRMING', newStateData);

      const confirmMessage = formatConfirmationMessage(
        newStateData.selectedService || '30min',
        calendar.formatBookingTime(newStateData.selectedTime || ''),
        newStateData.attendeeName || '',
        extractedData.email
      );

      await facebook.sendQuickReplies(
        senderId,
        confirmMessage,
        facebook.createConfirmationQuickReplies()
      );
    } else {
      await facebook.sendTextMessage(
        senderId,
        "That doesn't look like a valid email address. Could you please provide your email?"
      );
    }
  }
}

async function handleBookingConfirmation(
  senderId: string,
  conversationId: string,
  stateData: StateData
): Promise<void> {
  const { selectedTime, attendeeName, attendeeEmail, selectedService } = stateData;

  if (!selectedTime || !attendeeName || !attendeeEmail) {
    await facebook.sendTextMessage(
      senderId,
      "I'm missing some information. Let's start over. Would you like to book a demo or discovery call?"
    );
    await db.resetConversation(conversationId);
    return;
  }

  try {
    // Create booking in Cal.com
    const booking = await calendar.createBooking(
      selectedTime,
      attendeeName,
      attendeeEmail
    );

    // Save booking to database
    await db.createBooking(conversationId, {
      cal_booking_id: booking.id.toString(),
      cal_booking_uid: booking.uid,
      service_type: selectedService,
      scheduled_at: new Date(booking.startTime),
      attendee_name: attendeeName,
      attendee_email: attendeeEmail,
      status: 'confirmed',
    });

    // Update conversation state
    await db.updateConversationState(conversationId, 'BOOKED', {});

    // Send confirmation
    const message = formatBookingConfirmedMessage(
      calendar.formatBookingTime(booking.startTime)
    );
    await facebook.sendTextMessage(senderId, message);
  } catch (error) {
    console.error('Error creating booking:', error);
    await facebook.sendTextMessage(
      senderId,
      "I'm sorry, there was an error creating your booking. Please try again or contact us directly."
    );
  }
}

async function handleCancellation(
  senderId: string,
  conversationId: string
): Promise<void> {
  const booking = await db.getActiveBookingForConversation(conversationId);

  if (!booking || !booking.cal_booking_uid) {
    await facebook.sendTextMessage(
      senderId,
      "I don't see any active bookings for you. Would you like to schedule a new demo or discovery call?"
    );
    return;
  }

  const cancelled = await calendar.cancelBooking(booking.cal_booking_uid);

  if (cancelled) {
    await db.updateBookingStatus(booking.id, 'cancelled');
    await db.resetConversation(conversationId);
    await facebook.sendTextMessage(
      senderId,
      "Your booking has been cancelled. Would you like to schedule a new appointment?"
    );
  } else {
    await facebook.sendTextMessage(
      senderId,
      "I couldn't cancel your booking. Please contact us directly for assistance."
    );
  }
}

async function handleReschedule(
  senderId: string,
  conversationId: string
): Promise<void> {
  const booking = await db.getActiveBookingForConversation(conversationId);

  if (!booking || !booking.cal_booking_uid) {
    await facebook.sendTextMessage(
      senderId,
      "I don't see any active bookings for you. Would you like to schedule a new demo or discovery call?"
    );
    return;
  }

  // Cancel existing and start new booking flow
  const cancelled = await calendar.cancelBooking(booking.cal_booking_uid);

  if (cancelled) {
    await db.updateBookingStatus(booking.id, 'cancelled');
    await db.updateConversationState(conversationId, 'COLLECTING_SERVICE', {});
    await facebook.sendQuickReplies(
      senderId,
      "I've cancelled your existing booking. Let's schedule a new one! Which would you like - a quick demo or a discovery call?",
      facebook.createServiceQuickReplies()
    );
  } else {
    await facebook.sendTextMessage(
      senderId,
      "I couldn't reschedule your booking. Please contact us directly for assistance."
    );
  }
}
