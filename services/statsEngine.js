/**
 * Core math for every review period (weekly/monthly/quarterly/annual).
 * All periods call computeStats() on the raw trades inside that date range -
 * this keeps rate-based metrics (win rate, avg win/loss, compliance) correct
 * for any roll-up instead of averaging pre-computed weekly averages together.
 * Pure count/sum metrics (wins, losses, netPnl, netR, ruleBreakCount) come out
 * identical to "summing the weekly numbers" as a result.
 */

function computeStats(trades) {
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.outcome === 'win');
  const losses = trades.filter(t => t.outcome === 'loss');
  const breakeven = trades.filter(t => t.outcome === 'breakeven');

  const winRate = totalTrades ? (wins.length / totalTrades) * 100 : 0;
  const netPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const netR = trades.reduce((s, t) => s + (t.rMultiple || 0), 0);

  const avgWinPnl = wins.length ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
  const avgWinR = wins.length ? wins.reduce((s, t) => s + (t.rMultiple || 0), 0) / wins.length : 0;
  const avgLossPnl = losses.length ? losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length : 0;
  const avgLossR = losses.length ? losses.reduce((s, t) => s + (t.rMultiple || 0), 0) / losses.length : 0;

  const ruleBreakCount = trades.filter(t => t.ruleBroken).length;
  const fomoTradeCount = trades.filter(t => t.fomoTrade).length;
  const missedSetupTradeCount = trades.filter(t => t.missedSetup).length;
  const compliantCount = trades.filter(t => t.followedPlan).length;
  const complianceRate = totalTrades ? (compliantCount / totalTrades) * 100 : 0;

  // Max drawdown from the equity curve built by walking trades in chronological order
  const sorted = [...trades].sort((a, b) => {
    const da = `${a.date}T${a.createdAt || ''}`;
    const db = `${b.date}T${b.createdAt || ''}`;
    return da.localeCompare(db);
  });
  let equity = 0, peak = 0, maxDD = 0;
  for (const t of sorted) {
    equity += (t.pnl || 0);
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    totalTrades,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: round2(winRate),
    netPnl: round2(netPnl),
    netR: round2(netR),
    avgWinPnl: round2(avgWinPnl),
    avgWinR: round2(avgWinR),
    avgLossPnl: round2(avgLossPnl),
    avgLossR: round2(avgLossR),
    maxDrawdown: round2(maxDD),
    ruleBreakCount,
    fomoTradeCount,
    missedSetupTradeCount,
    complianceRate: round2(complianceRate),
  };
}

// Suggests the standout win/loss for a period so the "best trade / worst trade"
// reflection questions can pre-fill from the journal instead of starting blank.
function suggestBestWorst(trades) {
  const wins = trades.filter(t => t.outcome === 'win');
  const losses = trades.filter(t => t.outcome === 'loss');

  const scoreOf = (t) => (t.rMultiple || t.pnl || 0);

  const best = wins.length
    ? wins.reduce((a, b) => (scoreOf(b) > scoreOf(a) ? b : a))
    : null;
  const worst = losses.length
    ? losses.reduce((a, b) => (scoreOf(b) < scoreOf(a) ? b : a))
    : null;

  return { best, worst };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function fmtDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// weekStart must be the Sunday of that week (YYYY-MM-DD)
function weekRange(weekStartStr) {
  const start = new Date(weekStartStr + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: fmtDate(start), end: fmtDate(end) };
}

function monthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: fmtDate(start), end: fmtDate(end) };
}

// Calendar-year quarters: Q1 Jan-Mar, Q2 Apr-Jun, Q3 Jul-Sep, Q4 Oct-Dec
function quarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { start: fmtDate(start), end: fmtDate(end) };
}

function yearRange(year) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

// Builds a chronological equity curve from ALL trades (cumulative pnl running total).
// Used by both the /api/stats/equity-curve endpoint and the guardrail drawdown check,
// so "current drawdown" always means the same thing in both places.
function computeEquityCurve(trades) {
  const sorted = [...trades].sort((a, b) => {
    const da = `${a.date}T${a.createdAt || ''}`;
    const db = `${b.date}T${b.createdAt || ''}`;
    return da.localeCompare(db);
  });
  let equity = 0, peak = 0;
  const points = [];
  for (const t of sorted) {
    equity += (t.pnl || 0);
    if (equity > peak) peak = equity;
    points.push({
      date: t.date,
      tradeId: t._id,
      pnl: round2(t.pnl || 0),
      equity: round2(equity),
      peak: round2(peak),
      drawdown: round2(peak - equity),
    });
  }
  return points;
}

module.exports = { computeStats, suggestBestWorst, weekRange, monthRange, quarterRange, yearRange, fmtDate, computeEquityCurve };
