-- Facebook Booking Bot Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facebook_user_id TEXT UNIQUE NOT NULL,
  state TEXT DEFAULT 'IDLE',
  state_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table (for conversation context)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  intent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  cal_booking_id TEXT,
  cal_booking_uid TEXT UNIQUE,
  service_type TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  attendee_name TEXT,
  attendee_email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_facebook_user_id ON conversations(facebook_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_conversation_id ON bookings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bookings_cal_booking_uid ON bookings(cal_booking_uid);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for conversations updated_at
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old messages (keep last 20 per conversation)
CREATE OR REPLACE FUNCTION cleanup_old_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM messages
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY conversation_id
        ORDER BY created_at DESC
      ) as rn
      FROM messages
    ) ranked
    WHERE rn > 20
  );
END;
$$ LANGUAGE plpgsql;

-- Reset stale conversations (inactive for 30+ minutes)
CREATE OR REPLACE FUNCTION reset_stale_conversations()
RETURNS void AS $$
BEGIN
  UPDATE conversations
  SET state = 'IDLE', state_data = '{}'
  WHERE state != 'IDLE'
    AND state != 'BOOKED'
    AND updated_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;
