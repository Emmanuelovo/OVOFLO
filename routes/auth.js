const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Settings = require('../models/Settings');
const requireAuth = require('../middleware/auth');

let googleClient = null;
if (process.env.GOOGLE_CLIENT_ID) {
  const { OAuth2Client } = require('google-auth-library');
  googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
}

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

async function ensureSettings(userId) {
  const existing = await Settings.findOne({ userId });
  if (!existing) await Settings.create({ userId });
}

// Tells the frontend whether to show the "Sign in with Google" button at all.
router.get('/config', (req, res) => {
  res.json({ googleEnabled: !!process.env.GOOGLE_CLIENT_ID, googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

    const user = new User({ email, name: name || '' });
    await user.setPassword(password);
    await user.save();
    await ensureSettings(user._id);

    const token = signToken(user);
    res.status(201).json({ token, user: user.toSafeJSON() });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const ok = await user.checkPassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = signToken(user);
    res.json({ token, user: user.toSafeJSON() });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Frontend sends the Google ID token it got from Google Identity Services.
// We verify it against Google's servers (not just decode it) before trusting it.
router.post('/google', async (req, res) => {
  try {
    if (!googleClient) return res.status(400).json({ error: 'Google sign-in is not configured on this server.' });
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Missing Google ID token.' });

    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase().trim();

    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
    if (!user) {
      user = new User({ email, name: payload.name || '', googleId: payload.sub, profilePicture: payload.picture || '' });
      await user.save();
      await ensureSettings(user._id);
    } else if (!user.googleId) {
      user.googleId = payload.sub; // link an existing email/password account to Google
      if (!user.profilePicture && payload.picture) user.profilePicture = payload.picture;
      await user.save();
    }

    const token = signToken(user);
    res.json({ token, user: user.toSafeJSON() });
  } catch (err) {
    res.status(401).json({ error: 'Could not verify Google sign-in.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: user.toSafeJSON() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (typeof name === 'string') user.name = name;
    await user.save();
    res.json({ user: user.toSafeJSON() });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Accepts a base64 data URL (from a <canvas>-resized image on the frontend).
// Capped well under MongoDB's 16MB document limit - a resized ~400px avatar
// is a few hundred KB at most as base64.
router.put('/profile-picture', requireAuth, async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Send a valid image data URL.' });
    }
    if (imageDataUrl.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image is too large after resizing. Try a smaller photo.' });
    }
    const user = await User.findByIdAndUpdate(req.userId, { profilePicture: imageDataUrl }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: user.toSafeJSON() });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/profile-picture', requireAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.userId, { profilePicture: '' }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: user.toSafeJSON() });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;