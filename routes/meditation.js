const express = require('express');
const router = express.Router();
const Meditation = require('../models/Meditation');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { limit } = req.query;
    let cursor = Meditation.find({ userId: req.userId }).sort({ createdAt: -1 });
    if (limit) cursor = cursor.limit(parseInt(limit, 10));
    res.json(await cursor);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const doc = await Meditation.create({ ...req.body, userId: req.userId });
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
