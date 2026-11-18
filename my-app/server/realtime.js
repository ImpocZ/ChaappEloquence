import { Server } from 'socket.io';
import { pool } from './db.js';

export function setupRealtime(httpServer, sessionMiddleware, frontendOrigin) {
  const io = new Server(httpServer, {
    cors: {
      origin: frontendOrigin,
      credentials: true,
    },
  });

  io.engine.use(sessionMiddleware);

    io.use(async (socket, next) => {
    const userId = socket.request.session?.userId;
    const roomId = socket.handshake.auth.roomId;

    if (userId == null) {
        return next(new Error('Not signed in.'));
    }

    if (
        typeof roomId !== 'string' ||
        !/^[1-9]\d{0,18}$/.test(roomId) ||
        BigInt(roomId) > 9223372036854775807n
    ) {
        return next(new Error('Invalid room ID.'));
    }

    try {
        const result = await pool.query(
        `SELECT 1
        FROM memberships
        WHERE user_id = $1
            AND room_id = $2
            AND membership_active = TRUE`,
        [userId, roomId]
        );

        if (result.rows.length === 0) {
        return next(new Error('Active room membership is required.'));
        }

        socket.data.roomId = roomId;
        next();
    } catch (error) {
        console.error('Could not check socket membership:', error.message);
        next(new Error('Could not join the room.'));
    }
    });

    io.on('connection', async socket => {
    await socket.join(`room:${socket.data.roomId}`);
    socket.emit('room:ready');
    });

  return io;
}