const express = require('express');
const router = express.Router();
const MissedSetup = require('../models/MissedSetup');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { start, end } = req.query;
    let query = { userId: req.userId };
    if (start && end) query.date = { $gte: start, $lte: end };
    res.json(await MissedSetup.find(query).sort({ date: -1 }));
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
    await MissedSetup.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
