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
        "Oh, I can't view attachments yet! Just send me a message and I'd be happy to help 😊"
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

    // Check for "start over" commands
    const lowerMessage = (messageText || '').toLowerCase().trim();
    const isStartOver = lowerMessage === 'start over' ||
                        lowerMessage === 'new booking' ||
                        lowerMessage === 'reset' ||
                        lowerMessage === 'start again';

    if (isStartOver || (state === 'BOOKED' && !quickReplyPayload && !postbackPayload)) {
      await db.resetConversation(conversation.id);
      await facebook.sendTextMessage(
        senderId,
        "Hey! Ready to book another session? I can set you up with a demo or discovery call 😊"
      );
      return;
    }

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

      // Shortcut: if user types just a number, select that slot directly
      const numMatch = userInput.trim().match(/^(\d+)$/);
      if (numMatch) {
        const slotIndex = parseInt(numMatch[1], 10) - 1;
        if (slotIndex >= 0 && slotIndex < availableSlots.length) {
          const selectedSlot = availableSlots[slotIndex];
          await handleTimeSelection(senderId, conversation.id, selectedSlot.time, stateData);
          return;
        }
      }
    }

    // Generate AI response
    console.log(`Generating AI response for state: ${state}, input: "${userInput.substring(0, 50)}..."`);
    const aiResponse = await ai.generateResponse(
      userInput,
      history,
      state,
      stateData,
      availableSlots
    );
    console.log(`AI response intent: ${aiResponse.intent}, text length: ${aiResponse.text.length}`);

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
      "Oops, something went wrong on my end! Can you try that again?"
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
        "No worries! Would you still like to book a demo or discovery call?"
      );
      break;

    case 'GET_STARTED':
      await facebook.sendTextMessage(
        senderId,
        "Hey! I'm Joy from Mindnistry 👋 Want to see how we can help your church? I can set you up with a quick demo or discovery call!"
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
      // Only process service selection in appropriate states
      if (state === 'IDLE' || state === 'COLLECTING_SERVICE') {
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
            "Which works better for you - a quick 30-min demo or a longer discovery call?",
            facebook.createServiceQuickReplies()
          );
        }
      } else {
        // Wrong state for service selection - AI made a mistake
        console.warn(`SELECT_SERVICE intent received but state is ${state}, sending AI text instead`);
        await facebook.sendTextMessage(senderId, aiResponse.text);
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
            "Hmm, I couldn't find that time. Could you just reply with the number (like 1 or 2)?"
          );
        }
      }
      break;

    case 'PROVIDE_INFO':
      // Only handle as info collection during booking flow
      if (state === 'COLLECTING_NAME' || state === 'COLLECTING_EMAIL') {
        await handleInfoProvided(
          senderId,
          conversationId,
          state,
          stateData,
          extractedData
        );
      } else {
        // For general info requests (not during booking), send the AI response
        await facebook.sendTextMessage(senderId, aiResponse.text);
      }
      break;

    case 'CONFIRM_BOOKING':
      // Only process confirmation if we're actually in CONFIRMING state
      if (state === 'CONFIRMING') {
        await handleBookingConfirmation(senderId, conversationId, stateData);
      } else {
        // AI returned wrong intent - just send the response text
        console.warn(`CONFIRM_BOOKING intent received but state is ${state}, ignoring`);
        await facebook.sendTextMessage(senderId, aiResponse.text);
      }
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
      "Having trouble loading the schedule right now. Can you try again in a bit?"
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
    `Nice! ${calendar.formatBookingTime(selectedTime)} it is 📅\n\nWhat's your name?`
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
        `Got it, ${extractedData.name}! And your email? (So I can send you the calendar invite)`
      );
    } else {
      await facebook.sendTextMessage(
        senderId,
        "Sorry, didn't catch that! What's your name?"
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
        "Hmm that doesn't look like an email. Can you double-check and send it again?"
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
      "Looks like I'm missing some info. Want to start fresh? I can help you book a demo!"
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
      "Oops, something went wrong booking that. Want to try again?"
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
      "I don't see any bookings under your name. Want me to set one up?"
    );
    return;
  }

  const cancelled = await calendar.cancelBooking(booking.cal_booking_uid);

  if (cancelled) {
    await db.updateBookingStatus(booking.id, 'cancelled');
    await db.resetConversation(conversationId);
    await facebook.sendTextMessage(
      senderId,
      "Done, I've cancelled that for you. Would you like to book a new time?"
    );
  } else {
    await facebook.sendTextMessage(
      senderId,
      "Hmm, I couldn't cancel that. Can you email us at support@mindnistry.com?"
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
      "I don't see any bookings under your name. Want me to set one up?"
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
      "Done! I've cancelled your old booking. Let's pick a new time - quick demo or discovery call?",
      facebook.createServiceQuickReplies()
    );
  } else {
    await facebook.sendTextMessage(
      senderId,
      "Having trouble rescheduling. Mind emailing us at support@mindnistry.com?"
    );
  }
}
