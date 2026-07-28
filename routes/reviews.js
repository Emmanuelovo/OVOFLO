const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const WeeklyReview = require('../models/WeeklyReview');
const MonthlyReview = require('../models/MonthlyReview');
const QuarterlyReview = require('../models/QuarterlyReview');
const AnnualReview = require('../models/AnnualReview');
const requireAuth = require('../middleware/auth');
const { computeStats, suggestBestWorst, weekRange, monthRange, quarterRange, yearRange } = require('../services/statsEngine');

router.use(requireAuth);

async function tradesInRange(userId, start, end) {
  return Trade.find({ userId, date: { $gte: start, $lte: end } }).sort({ date: 1, createdAt: 1 }).lean();
}

/* ---------------- WEEKLY ---------------- */

// GET /api/reviews/weekly - every saved weekly review for this user, newest first.
// This is what powers the Reviews > History tab.
router.get('/weekly', async (req, res) => {
  try {
    const list = await WeeklyReview.find({ userId: req.userId }).sort({ weekStart: -1 });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/weekly/:weekStart', async (req, res) => {
  try {
    const { start, end } = weekRange(req.params.weekStart);
    const trades = await tradesInRange(req.userId, start, end);
    const stats = computeStats(trades);
    const { best, worst } = suggestBestWorst(trades);
    const saved = await WeeklyReview.findOne({ userId: req.userId, weekStart: req.params.weekStart });
    res.json({ range: { start, end }, stats, suggestions: { best, worst }, review: saved || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/weekly/:weekStart', async (req, res) => {
  try {
    const { end } = weekRange(req.params.weekStart);
    const { userId, ...rest } = req.body;
    const body = { ...rest, weekStart: req.params.weekStart, weekEnd: end, userId: req.userId };
    const doc = await WeeklyReview.findOneAndUpdate(
      { userId: req.userId, weekStart: req.params.weekStart }, body, { new: true, upsert: true, runValidators: true }
    );
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

/* ---------------- MONTHLY ---------------- */

router.get('/monthly', async (req, res) => {
  try {
    const list = await MonthlyReview.find({ userId: req.userId }).sort({ year: -1, month: -1 });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/monthly/:year/:month', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10), month = parseInt(req.params.month, 10);
    const { start, end } = monthRange(year, month);
    const trades = await tradesInRange(req.userId, start, end);
    const stats = computeStats(trades);
    const { best, worst } = suggestBestWorst(trades);

    const weeklyReviews = await WeeklyReview.find({ userId: req.userId, weekStart: { $gte: start, $lte: end } }).sort({ weekStart: 1 });

    const saved = await MonthlyReview.findOne({ userId: req.userId, year, month });
    res.json({ range: { start, end }, stats, suggestions: { best, worst }, weeklyReviews, review: saved || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/monthly/:year/:month', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10), month = parseInt(req.params.month, 10);
    const { userId, ...rest } = req.body;
    const body = { ...rest, year, month, userId: req.userId };
    const doc = await MonthlyReview.findOneAndUpdate(
      { userId: req.userId, year, month }, body, { new: true, upsert: true, runValidators: true }
    );
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

/* ---------------- QUARTERLY ---------------- */

router.get('/quarterly', async (req, res) => {
  try {
    const list = await QuarterlyReview.find({ userId: req.userId }).sort({ year: -1, quarter: -1 });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/quarterly/:year/:quarter', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10), quarter = parseInt(req.params.quarter, 10);
    const { start, end } = quarterRange(year, quarter);
    const trades = await tradesInRange(req.userId, start, end);
    const stats = computeStats(trades);
    const { best, worst } = suggestBestWorst(trades);

    const monthsInQ = [1, 2, 3].map(i => (quarter - 1) * 3 + i);
    const monthlyReviews = await MonthlyReview.find({ userId: req.userId, year, month: { $in: monthsInQ } }).sort({ month: 1 });

    const saved = await QuarterlyReview.findOne({ userId: req.userId, year, quarter });
    res.json({ range: { start, end }, stats, suggestions: { best, worst }, monthlyReviews, review: saved || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/quarterly/:year/:quarter', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10), quarter = parseInt(req.params.quarter, 10);
    const { userId, ...rest } = req.body;
    const body = { ...rest, year, quarter, userId: req.userId };
    const doc = await QuarterlyReview.findOneAndUpdate(
      { userId: req.userId, year, quarter }, body, { new: true, upsert: true, runValidators: true }
    );
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

/* ---------------- ANNUAL ---------------- */

router.get('/annual', async (req, res) => {
  try {
    const list = await AnnualReview.find({ userId: req.userId }).sort({ year: -1 });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/annual/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const { start, end } = yearRange(year);
    const trades = await tradesInRange(req.userId, start, end);
    const stats = computeStats(trades);
    const { best, worst } = suggestBestWorst(trades);

    const quarterlyReviews = await QuarterlyReview.find({ userId: req.userId, year }).sort({ quarter: 1 });
    const monthlyReviews = await MonthlyReview.find({ userId: req.userId, year }).sort({ month: 1 });

    const saved = await AnnualReview.findOne({ userId: req.userId, year });
    res.json({ range: { start, end }, stats, suggestions: { best, worst }, quarterlyReviews, monthlyReviews, review: saved || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/annual/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const { userId, ...rest } = req.body;
    const body = { ...rest, year, userId: req.userId };
    const doc = await AnnualReview.findOneAndUpdate(
      { userId: req.userId, year }, body, { new: true, upsert: true, runValidators: true }
    );
    res.json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;