const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

/**
 * Economic calendar proxy.
 *
 * IMPORTANT: Forex Factory has no official public API. This calls a widely-used
 * UNOFFICIAL JSON feed (nfs.faireconomy.media) that several open-source calendar
 * widgets rely on. It is not documented or supported by anyone, can change shape,
 * rate-limit, or disappear without notice. Treat this as best-effort convenience
 * data, never as the sole input to a trading decision — always cross-check
 * anything high-impact directly on a source you trust.
 *
 * We proxy server-side (rather than calling it from the browser) because the
 * feed doesn't send CORS headers, and to keep a single point to swap the source
 * later if this one breaks.
 */

let cache = { data: null, fetchedAt: 0 };
const CACHE_MS = 10 * 60 * 1000; // 10 minutes — be a polite, infrequent caller

router.get('/calendar', async (req, res) => {
  try {
    const now = Date.now();
    if (cache.data && (now - cache.fetchedAt) < CACHE_MS) {
      return res.json({ source: 'unofficial-ff-feed', cached: true, events: cache.data });
    }

    const upstream = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: { 'User-Agent': 'OvoWorks-Trading-Suite/1.0' },
    });

    if (!upstream.ok) {
      throw new Error(`Upstream returned ${upstream.status}`);
    }

    const raw = await upstream.json();
    // Normalize the fields we actually use so the frontend doesn't depend on
    // the upstream's exact shape if it changes slightly.
    const events = (Array.isArray(raw) ? raw : []).map(e => ({
      title: e.title || e.event || '',
      country: e.country || '',
      date: e.date || '',
      impact: e.impact || '',
      forecast: e.forecast ?? '',
      previous: e.previous ?? '',
      actual: e.actual ?? '',
    }));

    cache = { data: events, fetchedAt: now };
    res.json({ source: 'unofficial-ff-feed', cached: false, events });
  } catch (err) {
    // Fail soft — the app should never break because a third-party scrape feed died.
    res.status(200).json({
      source: 'unofficial-ff-feed',
      error: 'Could not reach the economic calendar feed right now.',
      detail: err.message,
      events: [],
    });
  }
});

module.exports = router;
