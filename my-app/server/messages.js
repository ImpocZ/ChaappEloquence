// messages.js
import express from 'express';
import { pool } from './db.js';

export function registerMessageRoutes(app, io) {
    app.post('/api/rooms/:roomId/messages', express.json(), async (req, res) => {
    const userId = req.session?.userId;

    if (userId == null) {
        return res.status(401).json({ error: 'Not signed in.' });
    }

    const roomId = req.params.roomId;

    if (
        !/^[1-9]\d{0,18}$/.test(roomId) ||
        BigInt(roomId) > 9223372036854775807n
    ) {
        return res.status(400).json({ error: 'Invalid room ID.' });
    }

    const content = typeof req.body?.content === 'string'
        ? req.body.content.trim()
        : '';

    if (content.length === 0) {
        return res.status(400).json({ error: 'Write a message before sending.' });
    }

    try {
        const result = await pool.query(
        `INSERT INTO messages (membership_id, content)
        SELECT memberships.membership_id, $1
        FROM memberships
        JOIN users ON users.user_id = memberships.user_id
        WHERE memberships.user_id = $2
            AND memberships.room_id = $3
            AND memberships.membership_active = TRUE
            AND users.username IS NOT NULL
        RETURNING message_id, membership_id, content, created_at`,
        [content, userId, roomId]
        );

        if (result.rows.length === 0) {
        return res.status(403).json({
            error: 'A nickname and active room membership are required.',
        });
        }
        io.to(`room:${roomId}`).emit('messages:changed');
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Could not save message:', error.message);
        return res.status(500).json({ error: 'Could not save message.' });
    }
    });

    app.get('/api/rooms/:roomId/messages', async (req, res) => {
    const userId = req.session?.userId;
    const roomId = req.params.roomId;

    if (userId == null) {
        return res.status(401).json({ error: 'Not signed in.' });
    }

    if (
        !/^[1-9]\d{0,18}$/.test(roomId) ||
        BigInt(roomId) > 9223372036854775807n
    ) {
        return res.status(400).json({ error: 'Invalid room ID.' });
    }

    try {
        const result = await pool.query(
        `SELECT history.*
        FROM memberships AS viewer
        LEFT JOIN LATERAL (
            SELECT messages.message_id, messages.content,
                    messages.created_at, users.username
            FROM messages
            JOIN memberships AS sender
            ON sender.membership_id = messages.membership_id
            JOIN users ON users.user_id = sender.user_id
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
        return res.status(403).json({ error: 'Active room membership is required.' });
        }

        const messages = result.rows
        .filter(row => row.message_id !== null)
        .reverse();

        return res.json(messages);
    } catch (error) {
        console.error('Could not load messages:', error.message);
        return res.status(500).json({ error: 'Could not load messages.' });
    }
    });
}