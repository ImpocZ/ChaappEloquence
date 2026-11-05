//Only Authentication choices will be here
//client id, client secret to auth from github
//get code from github and fetch access token from github
//via access token, fetch user data from github and send it to the client
//voila, user sees his name and avatar on the client side and can use the app
//https://github.com/login/oauth/authorize
//Need to create a local .env file and install dotenv
import express from 'express';
import 'dotenv/config';
import session from 'cookie-session';
import cors from 'cors';
import { pool } from './db.js';

const app = express();

app.use(session({
  name: 'auth',
  keys: [process.env.SECRET_KEY1, process.env.SECRET_KEY2],
  httpOnly: true,
  maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
}));

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));   


const client_id = process.env.GITHUB_CLIENT_ID;
const client_secret = process.env.GITHUB_CLIENT_SECRET;
const redirect_uri = "http://localhost:3001/callback";

app.get('/auth/github', (req, res) => {
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&scope=read:user`);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;

  // Trade code for token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id, client_secret, code, redirect_uri }),
  });
  const { access_token } = await tokenRes.json();

  // Get the user
  const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${access_token}` },
    });
  const user = await userRes.json();

  if (!userRes.ok || user.id == null) {
    return res.status(502).send('Could not load your GitHub profile.');
  }

  const githubId = String(user.id);
  let userId;

  try {
    const db = await pool.connect();

    try {
      await db.query('BEGIN');

      const accountResult = await db.query(
        `SELECT user_id
        FROM auth_accounts
        WHERE provider = 'github' AND provider_user_id = $1`,
        [githubId]
      );

      if (accountResult.rows.length > 0) {
        userId = accountResult.rows[0].user_id;
      } else {
        const userResult = await db.query(
          `INSERT INTO users (avatar_url)
          VALUES ($1)
          RETURNING user_id`,
          [user.avatar_url]
        );

        userId = userResult.rows[0].user_id;

        await db.query(
          `INSERT INTO auth_accounts (user_id, provider, provider_user_id)
          VALUES ($1, 'github', $2)`,
          [userId, githubId]
        );
      }

      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  } catch (error) {
    console.error('Could not save GitHub sign-in:', error.message);
    return res.status(500).send('Could not complete sign-in. Please try again.');
  }

  req.session.userId = userId;
  console.log('Signed in as app user:', userId);
    // Store in session
    res.redirect('http://localhost:5173/chat');
});

app.get('/api/me', async (req, res) => {
  const userId = req.session?.userId;

  if (userId == null) {
    return res.status(401).json({ error: 'not authed' });
  }

  try {
    const result = await pool.query(
      `SELECT username, avatar_url
       FROM users
       WHERE user_id = $1`,
      [userId]
    );

    const profile = result.rows[0];

    if (!profile) {
      req.session = null;
      return res.status(401).json({ error: 'not authed' });
    }

    return res.json({
      username: profile.username,
      avatar: profile.avatar_url,
    });
  } catch (error) {
    console.error('Could not load chat profile:', error.message);
    return res.status(500).json({ error: 'Could not load chat profile.' });
  }
});

app.post('/api/me/username', express.json(), async (req, res) => {
  const userId = req.session?.userId;

  if (userId == null) {
    return res.status(401).json({ error: 'Not signed in.' });
  }

  const submittedUsername = req.body?.username;
  const username = typeof submittedUsername === 'string'
    ? submittedUsername.trim()
    : '';

  if (username.length === 0 || username.length > 30) {
    return res.status(400).json({
      error: 'Choose a username between 1 and 30 characters.',
    });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET username = $1
       WHERE user_id = $2 AND username IS NULL
       RETURNING username`,
      [username, userId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Could not set an initial username.' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    if (
      error.code === '23505' &&
      error.constraint === 'users_username_case_insensitive'
    ) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    console.error('Could not save username:', error.message);
    return res.status(500).json({ error: 'Could not save username.' });
  }
});

async function startServer() {
  try {
    const result = await pool.query('SELECT current_database() AS database');
    console.log('Connected to PostgreSQL:', result.rows[0].database);

    app.listen(3001, () => {
      console.log('Server running on http://localhost:3001');
    });
  } catch (error) {
    console.error('Could not connect to PostgreSQL:', error.message);
    await pool.end();
    process.exitCode = 1;
  }
}

startServer();