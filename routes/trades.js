const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const requireAuth = require('../middleware/auth');
const { evaluateGuardrails } = require('../services/guardrails');

router.use(requireAuth);

function withRMultiple(body) {
  const out = { ...body };
  const pnl = parseFloat(out.pnl) || 0;
  const risk = parseFloat(out.riskAmount) || 0;
  out.pnl = pnl;
  out.riskAmount = risk;
  out.rMultiple = risk > 0 ? Math.round((pnl / risk) * 100) / 100 : 0;
  return out;
}

router.get('/', async (req, res) => {
  try {
    const { date, start, end } = req.query;
    let query = { userId: req.userId };
    if (date) query.date = date;
    else if (start && end) query.date = { $gte: start, $lte: end };
    const trades = await Trade.find(query).sort({ date: 1, createdAt: 1 });
    res.json(trades);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const trade = await Trade.findOne({ _id: req.params.id, userId: req.userId });
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    res.json(trade);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { overrideGuardrails, userId, ...body } = req.body;
    const date = body.date;

    const status = await evaluateGuardrails(req.userId, date);
    if (status.blocked && !overrideGuardrails) {
      return res.status(403).json({
        error: 'guardrail_blocked',
        reasons: status.reasons,
        status,
        message: 'A guardrail is blocking new trades. Resend with overrideGuardrails: true to log it anyway.',
      });
    }

    const trade = await Trade.create({ ...withRMultiple(body), userId: req.userId });
    res.status(201).json(trade);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { userId, ...body } = req.body;
    const trade = await Trade.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId }, withRMultiple(body), { new: true, runValidators: true }
    );
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    res.json(trade);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const trade = await Trade.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
