const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const { evaluateGuardrails } = require('../services/guardrails');

router.use(requireAuth);

router.get('/status', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const status = await evaluateGuardrails(req.userId, date);
    res.json(status);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
