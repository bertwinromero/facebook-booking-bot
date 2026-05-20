import pg from 'pg';
import { config } from '../config/env.js';
import type { Conversation, Message, Booking, StateData, ConversationState, Intent } from '../types/index.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.database.url,
  ssl: { rejectUnauthorized: false },
});

// Conversation Operations
export async function getOrCreateConversation(facebookUserId: string): Promise<Conversation> {
  const existing = await pool.query<Conversation>(
    'SELECT * FROM conversations WHERE facebook_user_id = $1',
    [facebookUserId]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const result = await pool.query<Conversation>(
    `INSERT INTO conversations (facebook_user_id, state, state_data)
     VALUES ($1, 'IDLE', '{}')
     RETURNING *`,
    [facebookUserId]
  );

  return result.rows[0];
}

export async function updateConversationState(
  conversationId: string,
  state: ConversationState,
  stateData: StateData
): Promise<void> {
  await pool.query(
    `UPDATE conversations
     SET state = $1, state_data = $2, updated_at = NOW()
     WHERE id = $3`,
    [state, JSON.stringify(stateData), conversationId]
  );
}

export async function resetConversation(conversationId: string): Promise<void> {
  await pool.query(
    `UPDATE conversations
     SET state = 'IDLE', state_data = '{}', updated_at = NOW()
     WHERE id = $1`,
    [conversationId]
  );
}

// Message Operations
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  intent?: Intent
): Promise<Message> {
  const result = await pool.query<Message>(
    `INSERT INTO messages (conversation_id, role, content, intent)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [conversationId, role, content, intent]
  );

  return result.rows[0];
}

export async function getRecentMessages(
  conversationId: string,
  limit: number = 10
): Promise<Message[]> {
  const result = await pool.query<Message>(
    `SELECT * FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );

  return result.rows.reverse();
}

// Booking Operations
export async function createBooking(
  conversationId: string,
  data: Partial<Booking>
): Promise<Booking> {
  const result = await pool.query<Booking>(
    `INSERT INTO bookings (
      conversation_id, cal_booking_id, cal_booking_uid,
      service_type, scheduled_at, attendee_name, attendee_email, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      conversationId,
      data.cal_booking_id,
      data.cal_booking_uid,
      data.service_type,
      data.scheduled_at,
      data.attendee_name,
      data.attendee_email,
      data.status || 'confirmed',
    ]
  );

  return result.rows[0];
}

export async function getBookingByUid(uid: string): Promise<Booking | null> {
  const result = await pool.query<Booking>(
    'SELECT * FROM bookings WHERE cal_booking_uid = $1',
    [uid]
  );

  return result.rows[0] || null;
}

export async function updateBookingStatus(
  bookingId: string,
  status: 'pending' | 'confirmed' | 'cancelled'
): Promise<void> {
  await pool.query(
    'UPDATE bookings SET status = $1 WHERE id = $2',
    [status, bookingId]
  );
}

export async function getActiveBookingForConversation(
  conversationId: string
): Promise<Booking | null> {
  const result = await pool.query<Booking>(
    `SELECT * FROM bookings
     WHERE conversation_id = $1 AND status = 'confirmed'
     ORDER BY created_at DESC LIMIT 1`,
    [conversationId]
  );

  return result.rows[0] || null;
}

// Cleanup
export async function cleanupOldMessages(): Promise<void> {
  await pool.query('SELECT cleanup_old_messages()');
}

export async function resetStaleConversations(): Promise<void> {
  await pool.query('SELECT reset_stale_conversations()');
}

// Health check
export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { pool };
