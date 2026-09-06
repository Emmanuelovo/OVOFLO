const express = require('express');
const router = express.Router();
const MissedSetup = require('../models/MissedSetup');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

// GET /api/missed-setups?date=YYYY-MM-DD  or  ?start=&end=
router.get('/', async (req, res) => {
  try {
    const { date, start, end } = req.query;
    let query = { userId: req.userId };
    if (date) query.date = date;
    else if (start && end) query.date = { $gte: start, $lte: end };
    const docs = await MissedSetup.find(query).sort({ date: -1, createdAt: -1 });
    res.json(docs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const doc = await MissedSetup.create({ ...req.body, userId: req.userId });
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await MissedSetup.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!doc) return res.status(404).json({ error: 'Missed setup not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;