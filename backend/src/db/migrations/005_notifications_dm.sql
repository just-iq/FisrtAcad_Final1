-- User notifications for personalized alerts (class reminders, assignment deadlines, etc.)
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('CLASS_REMINDER', 'ASSIGNMENT_DEADLINE', 'ANNOUNCEMENT', 'SYSTEM')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID NULL, -- reference to timetable_entry_id or assignment_id
  read_at TIMESTAMPTZ NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_time ON user_notifications(user_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON user_notifications(user_id, read_at) WHERE read_at IS NULL;

-- Direct messages for personal chats
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fetching conversations between two users
CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(
  LEAST(sender_id, receiver_id), 
  GREATEST(sender_id, receiver_id), 
  created_at DESC
);

-- Index for listing a user's conversations
CREATE INDEX IF NOT EXISTS idx_dm_user ON direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages(receiver_id, created_at DESC);
