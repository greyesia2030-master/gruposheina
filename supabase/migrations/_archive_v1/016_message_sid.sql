-- Migration 016: Add message_sid to conversation_logs for Twilio deduplication
-- Applied: 2026-04-13

ALTER TABLE conversation_logs
  ADD COLUMN IF NOT EXISTS message_sid text;

CREATE INDEX IF NOT EXISTS idx_conv_logs_sid
  ON conversation_logs(message_sid)
  WHERE message_sid IS NOT NULL;
