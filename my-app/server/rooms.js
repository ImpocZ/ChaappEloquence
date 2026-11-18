// rooms.js
import { pool } from './db.js';

export function registerRoomRoutes(app) {
  app.get('/api/rooms', async (req, res) => {
    const userId = req.session?.userId;

    if (userId == null) {
      return res.status(401).json({ error: 'Not signed in.' });
    }

    try {
      const result = await pool.query(
        `SELECT rooms.room_id, rooms.name, rooms.type
         FROM memberships
         JOIN rooms ON rooms.room_id = memberships.room_id
         WHERE memberships.user_id = $1
           AND memberships.membership_active = TRUE
         ORDER BY rooms.room_id`,
        [userId]
      );

      return res.json(result.rows);
    } catch (error) {
      console.error('Could not load rooms:', error.message);
      return res.status(500).json({ error: 'Could not load rooms.' });
    }
  });
}