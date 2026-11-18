import 'dotenv/config';
import express from 'express';
import session from 'cookie-session';
import cors from 'cors';
import { createServer } from 'node:http';
import { pool } from './db.js';
import { registerAuthRoutes } from './auth.js';
import { registerRoomRoutes } from './rooms.js';
import { registerMessageRoutes } from './messages.js';
import { setupRealtime } from './realtime.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

const sessionMiddleware = session({
  name: 'auth',
  keys: [process.env.SECRET_KEY1, process.env.SECRET_KEY2],
  httpOnly: true,
  maxAge: 60 * 60 * 1000,
});

app.use(sessionMiddleware);
app.use(cors({ origin: frontendOrigin, credentials: true }));

const httpServer = createServer(app);
const io = setupRealtime(httpServer, sessionMiddleware, frontendOrigin);

registerAuthRoutes(app, frontendOrigin);
registerRoomRoutes(app);
registerMessageRoutes(app, io);

async function startServer() {
  try {
    const result = await pool.query('SELECT current_database() AS database');
    console.log('Connected to PostgreSQL:', result.rows[0].database);

    httpServer.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Could not connect to PostgreSQL:', error.message);
    await pool.end();
    process.exitCode = 1;
  }
}

startServer();