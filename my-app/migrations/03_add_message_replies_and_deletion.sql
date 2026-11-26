ALTER TABLE messages
  ADD COLUMN reply_to_message_id BIGINT,
  ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE messages
  ADD CONSTRAINT messages_reply_to_message_id_fkey
  FOREIGN KEY (reply_to_message_id)
  REFERENCES messages (message_id);

CREATE INDEX messages_reply_to_message_id_idx
  ON messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;