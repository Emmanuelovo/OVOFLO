const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

async function getForUser(userId) {
  let doc = await Settings.findOne({ userId });
  if (!doc) doc = await Settings.create({ userId });
  return doc;
}

router.get('/', async (req, res) => {
  try {
    res.json(await getForUser(req.userId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/', async (req, res) => {
  try {
    const doc = await getForUser(req.userId);
    if (req.body.preferences) doc.preferences = { ...doc.preferences.toObject(), ...req.body.preferences };
    if (req.body.guardrails) doc.guardrails = { ...doc.guardrails.toObject(), ...req.body.guardrails };
    await doc.save();
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
