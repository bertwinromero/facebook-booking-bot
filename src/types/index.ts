// Conversation States
export type ConversationState =
  | 'IDLE'
  | 'COLLECTING_SERVICE'
  | 'SHOWING_TIMES'
  | 'COLLECTING_NAME'
  | 'COLLECTING_EMAIL'
  | 'CONFIRMING'
  | 'BOOKED';

// AI Intent Types
export type Intent =
  | 'GENERAL'
  | 'BOOK'
  | 'RESCHEDULE'
  | 'CANCEL'
  | 'CONFIRM_BOOKING'
  | 'SELECT_SERVICE'
  | 'SELECT_TIME'
  | 'PROVIDE_INFO';

// Service Types
export type ServiceType = '30min' | '60min';

// AI Response
export interface AIResponse {
  text: string;
  intent: Intent;
  extractedData?: {
    service?: ServiceType;
    preferredDate?: string;
    selectedTime?: string;
    name?: string;
    email?: string;
  };
  showAvailability?: boolean;
}

// Database Models
export interface Conversation {
  id: string;
  facebook_user_id: string;
  state: ConversationState;
  state_data: StateData;
  created_at: Date;
  updated_at: Date;
}

export interface StateData {
  selectedService?: ServiceType;
  selectedTime?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  availableSlots?: AvailabilitySlot[];
  pendingBookingId?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: Intent;
  created_at: Date;
}

export interface Booking {
  id: string;
  conversation_id: string;
  cal_booking_id?: string;
  cal_booking_uid?: string;
  service_type?: ServiceType;
  scheduled_at?: Date;
  attendee_name?: string;
  attendee_email?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: Date;
}

// Facebook Webhook Types
export interface FacebookWebhookEvent {
  object: string;
  entry: FacebookEntry[];
}

export interface FacebookEntry {
  id: string;
  time: number;
  messaging?: FacebookMessaging[];
  changes?: FacebookChange[];
}

export interface FacebookMessaging {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{
      type: string;
      payload: { url?: string };
    }>;
    quick_reply?: { payload: string };
  };
  postback?: {
    title: string;
    payload: string;
  };
}

export interface FacebookChange {
  field: string;
  value: {
    item: string;
    verb: string;
    comment_id?: string;
    post_id?: string;
    parent_id?: string;
    message?: string;
    from: { id: string; name: string };
    created_time: number;
  };
}

// Cal.com Types
export interface AvailabilitySlot {
  time: string;
  displayTime: string;
}

export interface CalBookingRequest {
  eventTypeId: number;
  start: string;
  responses: {
    name: string;
    email: string;
  };
  timeZone: string;
  language: string;
  metadata?: Record<string, string>;
}

export interface CalBookingResponse {
  id: number;
  uid: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
}

// Quick Reply Types
export interface QuickReply {
  content_type: 'text';
  title: string;
  payload: string;
}

export interface Button {
  type: 'postback' | 'web_url';
  title: string;
  payload?: string;
  url?: string;
}
