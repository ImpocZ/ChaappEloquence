# GitHub + Google + Discord Auth + Socket.IO — Project Reference
## Architecture
my-project/
├── server/
│   ├── auth.js          ← port 3001, Express, OAuth routes
│   └── realtime.js      ← port 3002, Socket.IO only
├── src/
│   ├── authentication.vue   ← overlay UI with buttons
│   └── useAuth.js           ← frontend logic (imported into .vue)

One frontend (Vue, port 5173) → two backend servers (auth :3001, realtime :3002).

server/auth.js (port 3001)
const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/auth/github', async (req, res) => {
  const { code } = req.body;
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GH_CLIENT_ID,
      client_secret: process.env.GH_CLIENT_SECRET,
      code,
    }),
  });
  const { access_token } = await tokenRes.json();
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  res.json({ user: await userRes.json() });
});

app.post('/api/auth/google', async (req, res) => {
  const { code } = req.body;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GG_CLIENT_ID,
      client_secret: process.env.GG_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:5173/callback',
    }),
  });
  const { access_token } = await tokenRes.json();
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  res.json({ user: await userRes.json() });
});

app.post('/api/auth/discord', async (req, res) => {
  const { code } = req.body;
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DC_CLIENT_ID,
      client_secret: process.env.DC_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:5173/callback',
    }),
  });
  const { access_token } = await tokenRes.json();
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  res.json({ user: await userRes.json() });
});

app.listen(3001, () => console.log('Auth server on :3001'));

server/realtime.js (port 3002)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: 'http://localhost:5173' } });

io.on('connection', (socket) => {
  socket.data.username = socket.handshake.auth.username;

  socket.on('message', (data) => {
    io.emit('message', { from: socket.data.username, text: data.text });
  });
  socket.on('image', (data) => {
    io.emit('image', { from: socket.data.username, src: data.src });
  });
  socket.on('giphy', (data) => {
    io.emit('giphy', { from: socket.data.username, url: data.url });
  });
});

server.listen(3002, () => console.log('Realtime server on :3002'));

src/useAuth.js (frontend)
import { io } from 'socket.io-client';

const providers = {
  github:  { authUrl: 'https://github.com/login/oauth/authorize', clientId: import.meta.env.VITE_GH_CLIENT_ID, api: '/api/auth/github' },
  google:  { authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', clientId: import.meta.env.VITE_GG_CLIENT_ID, api: '/api/auth/google' },
  discord: { authUrl: 'https://discord.com/oauth2/authorize', clientId: import.meta.env.VITE_DC_CLIENT_ID, api: '/api/auth/discord' },
};

export function useAuth() {
  const startLogin = (provider) => {
    const p = providers[provider];
    const params = new URLSearchParams({
      client_id: p.clientId,
      redirect_uri: 'http://localhost:5173/callback',
      response_type: 'code',
      scope: provider === 'discord' ? 'identify' : 'read:user user:email',
    });
    window.location.href = `${p.authUrl}?${params}`;
  };

  const handleCallback = async (provider) => {
    const code = new URLSearchParams(window.location.search).get('code');
    const res = await fetch(`http://localhost:3001${providers[provider].api}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const { user } = await res.json();
    return user;
  };

  const connectSocket = (user) => {
    const socket = io('http://localhost:3002', {
      auth: { username: user.login || user.name || user.username, avatar: user.avatar_url || user.picture },
    });
    return socket;
  };

  return { startLogin, handleCallback, connectSocket };
}

src/authentication.vue (overlay)
<template>
  <div class="overlay">
    <button @click="startLogin('github')">Sign in with GitHub</button>
    <button @click="startLogin('google')">Sign in with Google</button>
    <button @click="startLogin('discord')">Sign in with Discord</button>
  </div>
</template>

<script setup>
import { useAuth } from './useAuth.js';
const { startLogin, handleCallback } = useAuth();
</script>

Key facts
Topic	Detail
Localhost callbacks	http://localhost:PORT is allowed by GitHub — no HTTPS needed
One callback URL per OAuth app	Register separate apps for dev vs prod
Client secret	Never in frontend, only in server/auth.js env vars
Code exchange	Always POST (you're sending data)
First step	window.location.href (browser redirect), not fetch
Socket auth	Pass user info via io(url, { auth: {...} }), read in socket.handshake.auth
Ports	Vue :5173, auth :3001, realtime :3002

Install
# Backend
npm install express socket.io

# Frontend (Vue project)
npm install socket.io-client

Run
node server/auth.js &
node server/realtime.js &
npm run dev   # Vue dev server

