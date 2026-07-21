const express = require('express');
const router = express.Router();
const DailySurvey = require('../models/DailySurvey');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { start, end } = req.query;
    let query = { userId: req.userId };
    if (start && end) query.date = { $gte: start, $lte: end };
    res.json(await DailySurvey.find(query).sort({ date: 1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:date', async (req, res) => {
  try {
    const doc = await DailySurvey.findOne({ date: req.params.date, userId: req.userId });
    res.json(doc || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:date', async (req, res) => {
  try {
    const { userId, date, ...rest } = req.body;
    const body = { ...rest, date: req.params.date, userId: req.userId };
    const doc = await DailySurvey.findOneAndUpdate(
      { date: req.params.date, userId: req.userId }, body, { new: true, upsert: true, runValidators: true }
    );
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
