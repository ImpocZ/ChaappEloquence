//Only Authentication choices will be here
//client id, client secret to auth from github
//get code from github and fetch access token from github
//via access token, fetch user data from github and send it to the client
//voila, user sees his name and avatar on the client side and can use the app
//https://github.com/login/oauth/authorize
import express from 'express';

const app = express();

const client_id = "Ov23liVGKeR1OVR1ajck";
const client_secret = "825bc94237c9097df5a5669cb2e33234f116c44d";
const redirect_uri = "http://localhost:3001/callback";

app.get('/auth/github', (req, res) => {
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&scope=read:user`);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;

  // Trade code for token (server-to-server, just a fetch)
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: client_id, client_secret: client_secret, code, redirect_uri: redirect_uri }),
  });
  const { access_token } = await tokenRes.json();

  // Get the user
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `token ${access_token}` },
  });
  const user = await userRes.json();

  // Now you have `user.login`, `user.avatar_url`, etc.
  // Set a cookie, create a session, redirect to your frontend — your choice.
  res.redirect(`http://localhost:5173/?user=${encodeURIComponent(user.login)}`);
});   

app.listen(3001, () => console.log('Server running on http://localhost:3001'));