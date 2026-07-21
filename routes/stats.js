const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const requireAuth = require('../middleware/auth');
const { computeEquityCurve } = require('../services/statsEngine');

router.use(requireAuth);

router.get('/equity-curve', async (req, res) => {
  try {
    const { start, end } = req.query;
    let query = { userId: req.userId };
    if (start && end) query.date = { $gte: start, $lte: end };
    const trades = await Trade.find(query).lean();
    res.json(computeEquityCurve(trades));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
