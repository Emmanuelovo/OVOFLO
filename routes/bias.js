const express = require('express');
const router = express.Router();
const DailyBias = require('../models/DailyBias');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { start, end, limit } = req.query;
    let query = { userId: req.userId };
    if (start && end) query.date = { $gte: start, $lte: end };
    let cursor = DailyBias.find(query).sort({ date: -1 });
    if (limit) cursor = cursor.limit(parseInt(limit, 10));
    res.json(await cursor);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:date', async (req, res) => {
  try {
    const doc = await DailyBias.findOne({ date: req.params.date, userId: req.userId });
    res.json(doc || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:date', async (req, res) => {
  try {
    const { userId, date, ...rest } = req.body;
    const body = { ...rest, date: req.params.date, userId: req.userId };
    const doc = await DailyBias.findOneAndUpdate(
      { date: req.params.date, userId: req.userId }, body, { new: true, upsert: true, runValidators: true }
    );
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
