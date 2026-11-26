// messages.js
import express from 'express';
import { pool } from './db.js';

function isValidId(value) {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

export function registerMessageRoutes(app, io) {
  app.post(
    '/api/rooms/:roomId/messages',
    express.json(),
    async (req, res) => {
      const userId = req.session?.userId;

      if (userId == null) {
        return res.status(401).json({ error: 'Not signed in.' });
      }

      const roomId = req.params.roomId;

      if (!isValidId(roomId)) {
        return res.status(400).json({ error: 'Invalid room ID.' });
      }

      const content = typeof req.body?.content === 'string'
        ? req.body.content.trim()
        : '';

      if (content.length === 0) {
        return res.status(400).json({
          error: 'Write a message before sending.',
        });
      }

      const replyToMessageId = req.body?.reply_to_message_id ?? null;

      if (
        replyToMessageId !== null &&
        !isValidId(replyToMessageId)
      ) {
        return res.status(400).json({
          error: 'Invalid reply message ID. Supply it as a string.',
        });
      }

      try {
        const result = await pool.query(
          `INSERT INTO messages (
             membership_id,
             content,
             reply_to_message_id
           )
           SELECT memberships.membership_id, $1, $4::bigint
           FROM memberships
           JOIN users ON users.user_id = memberships.user_id
           WHERE memberships.user_id = $2
             AND memberships.room_id = $3
             AND memberships.membership_active = TRUE
             AND users.username IS NOT NULL
             AND (
               $4::bigint IS NULL
               OR EXISTS (
                 SELECT 1
                 FROM messages AS original
                 JOIN memberships AS original_sender
                   ON original_sender.membership_id =
                      original.membership_id
                 WHERE original.message_id = $4::bigint
                   AND original_sender.room_id = memberships.room_id
                   AND original.deleted_at IS NULL
               )
             )
           RETURNING message_id, membership_id, content,
                     created_at, reply_to_message_id, deleted_at`,
          [content, userId, roomId, replyToMessageId]
        );

        if (result.rows.length === 0) {
          return res.status(403).json({
            error:
              'Sending requires a nickname, active room membership, ' +
              'and, for replies, an available message in this room.',
          });
        }

        io.to(`room:${roomId}`).emit('messages:changed');

        return res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error('Could not save message:', error.message);

        return res.status(500).json({
          error: 'Could not save message.',
        });
      }
    }
  );

  app.get('/api/rooms/:roomId/messages', async (req, res) => {
    const userId = req.session?.userId;

    if (userId == null) {
      return res.status(401).json({ error: 'Not signed in.' });
    }

    const roomId = req.params.roomId;

    if (!isValidId(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID.' });
    }

    try {
      const result = await pool.query(
        `SELECT history.*
         FROM memberships AS viewer
         LEFT JOIN LATERAL (
           SELECT
             messages.message_id,
             CASE
               WHEN messages.deleted_at IS NULL
                 THEN messages.content
               ELSE NULL
             END AS content,
             messages.created_at,
             messages.deleted_at,
             messages.reply_to_message_id,
             users.username,
             users.avatar_url AS avatar,
             (sender.user_id = viewer.user_id) AS is_own,
             CASE
               WHEN original.message_id IS NULL THEN NULL
               ELSE json_build_object(
                 'message_id', original.message_id::text,
                 'username', original_user.username,
                 'content', CASE
                   WHEN original.deleted_at IS NULL
                     THEN left(original.content, 150)
                   ELSE NULL
                 END,
                 'deleted_at', original.deleted_at
               )
             END AS reply
           FROM messages
           JOIN memberships AS sender
             ON sender.membership_id = messages.membership_id
           JOIN users ON users.user_id = sender.user_id
           LEFT JOIN messages AS original
             ON original.message_id = messages.reply_to_message_id
             AND EXISTS (
               SELECT 1
               FROM memberships AS original_membership
               WHERE original_membership.membership_id =
                     original.membership_id
                 AND original_membership.room_id = sender.room_id
             )
           LEFT JOIN memberships AS original_sender
             ON original_sender.membership_id = original.membership_id
           LEFT JOIN users AS original_user
             ON original_user.user_id = original_sender.user_id
           WHERE sender.room_id = viewer.room_id
           ORDER BY messages.created_at DESC, messages.message_id DESC
           LIMIT 50
         ) AS history ON TRUE
         WHERE viewer.user_id = $1
           AND viewer.room_id = $2
           AND viewer.membership_active = TRUE`,
        [userId, roomId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'Active room membership is required.',
        });
      }

      const messages = result.rows
        .filter(row => row.message_id !== null)
        .reverse();

      return res.json(messages);
    } catch (error) {
      console.error('Could not load messages:', error.message);

      return res.status(500).json({
        error: 'Could not load messages.',
      });
    }
  });

    app.get(
    '/api/rooms/:roomId/messages/:messageId/context',
    async (req, res) => {
      const userId = req.session?.userId;
      const { roomId, messageId } = req.params;

      if (userId == null) {
        return res.status(401).json({ error: 'Not signed in.' });
      }

      if (!isValidId(roomId) || !isValidId(messageId)) {
        return res.status(400).json({ error: 'Invalid room or message ID.' });
      }

      try {
        const result = await pool.query(
          `WITH permitted AS (
             SELECT target.message_id, target.created_at
             FROM messages AS target
             JOIN memberships AS author
               ON author.membership_id = target.membership_id
             JOIN memberships AS viewer
               ON viewer.room_id = author.room_id
             WHERE target.message_id = $3
               AND author.room_id = $2
               AND viewer.user_id = $1
               AND viewer.membership_active = TRUE
           ),
           context AS (
             (
               SELECT messages.*
               FROM messages
               JOIN memberships AS sender
                 ON sender.membership_id = messages.membership_id
               CROSS JOIN permitted
               WHERE sender.room_id = $2
                 AND (messages.created_at, messages.message_id)
                     <= (permitted.created_at, permitted.message_id)
               ORDER BY messages.created_at DESC, messages.message_id DESC
               LIMIT 26
             )
             UNION ALL
             (
               SELECT messages.*
               FROM messages
               JOIN memberships AS sender
                 ON sender.membership_id = messages.membership_id
               CROSS JOIN permitted
               WHERE sender.room_id = $2
                 AND (messages.created_at, messages.message_id)
                     > (permitted.created_at, permitted.message_id)
               ORDER BY messages.created_at, messages.message_id
               LIMIT 25
             )
           )
           SELECT
             context.message_id,
             CASE
               WHEN context.deleted_at IS NULL THEN context.content
               ELSE NULL
             END AS content,
             context.created_at,
             context.deleted_at,
             context.reply_to_message_id,
             users.username,
             users.avatar_url AS avatar,
             (sender.user_id = $1) AS is_own,
             CASE
               WHEN original.message_id IS NULL THEN NULL
               ELSE json_build_object(
                 'message_id', original.message_id::text,
                 'username', original_user.username,
                 'content', CASE
                   WHEN original.deleted_at IS NULL
                     THEN left(original.content, 150)
                   ELSE NULL
                 END,
                 'deleted_at', original.deleted_at
               )
             END AS reply
           FROM context
           JOIN memberships AS sender
             ON sender.membership_id = context.membership_id
           JOIN users ON users.user_id = sender.user_id
                      LEFT JOIN messages AS original
             ON original.message_id = context.reply_to_message_id
             AND EXISTS (
               SELECT 1
               FROM memberships AS original_membership
               WHERE original_membership.membership_id =
                     original.membership_id
                 AND original_membership.room_id = sender.room_id
             )
           LEFT JOIN memberships AS original_sender
             ON original_sender.membership_id = original.membership_id
           LEFT JOIN users AS original_user
             ON original_user.user_id = original_sender.user_id
           WHERE original_sender.membership_id IS NULL
              OR original.message_id IS NOT NULL
              OR context.reply_to_message_id IS NULL
           ORDER BY context.created_at, context.message_id`,
          [userId, roomId, messageId],
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: 'Message not found or room access unavailable.',
          });
        }

        return res.json(result.rows);
      } catch (error) {
        console.error('Could not load message context:', error.message);

        return res.status(500).json({
          error: 'Could not load the original message.',
        });
      }
    },
  );

}