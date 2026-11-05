ALTER TABLE memberships
    ADD COLUMN membership_id BIGINT GENERATED ALWAYS AS IDENTITY,
    ADD COLUMN membership_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE memberships
    DROP CONSTRAINT memberships_pkey,
    ADD PRIMARY KEY (membership_id),
    ADD UNIQUE (user_id, room_id);

ALTER TABLE messages
    ADD COLUMN membership_id BIGINT;

-- Match any existing messages to their sender's room membership.
UPDATE messages AS msg
SET membership_id = member.membership_id
FROM memberships AS member
WHERE member.user_id = msg.user_id
  AND member.room_id = msg.room_id;

ALTER TABLE messages
    ALTER COLUMN membership_id SET NOT NULL,
    ADD CONSTRAINT messages_membership_id_fkey
        FOREIGN KEY (membership_id) REFERENCES memberships (membership_id),
    DROP COLUMN user_id,
    DROP COLUMN room_id;

CREATE INDEX messages_membership_history_idx
    ON messages (membership_id, created_at, message_id);