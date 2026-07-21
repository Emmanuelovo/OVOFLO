const Trade = require('../models/Trade');
const Settings = require('../models/Settings');
const { computeEquityCurve } = require('./statsEngine');

async function getSettings(userId) {
  let doc = await Settings.findOne({ userId });
  if (!doc) doc = await Settings.create({ userId });
  return doc;
}

/**
 * Evaluates every guardrail for a specific user against current state.
 * Read-only - callers decide whether to block based on `blocked`.
 */
async function evaluateGuardrails(userId, date) {
  const settings = await getSettings(userId);
  const g = settings.guardrails;

  if (!g.enabled) {
    return { enabled: false, blocked: false, reasons: [], todayTradeCount: 0, todayPnl: 0, drawdownPct: 0, suggestedRiskAmount: 0 };
  }

  const capital = g.accountCapital || 0;
  const maxDailyLoss = -Math.abs(capital * (g.maxDailyLossPct / 100));
  const maxDailyProfit = Math.abs(capital * (g.maxDailyProfitPct / 100));
  const maxDrawdownAmount = capital * (g.maxAccountDrawdownPct / 100);
  const suggestedRiskAmount = round2(capital * (g.riskPerTradePct / 100));

  const todayTrades = await Trade.find({ userId, date }).lean();
  const todayTradeCount = todayTrades.length;
  const todayPnl = round2(todayTrades.reduce((s, t) => s + (t.pnl || 0), 0));

  const allTrades = await Trade.find({ userId }).lean();
  const curve = computeEquityCurve(allTrades);
  const currentDrawdown = curve.length ? curve[curve.length - 1].drawdown : 0;
  const drawdownPct = capital > 0 ? round2((currentDrawdown / capital) * 100) : 0;

  const reasons = [];
  if (todayTradeCount >= g.maxTradesPerDay) {
    reasons.push(`Daily trade limit reached (${todayTradeCount}/${g.maxTradesPerDay} trades today).`);
  }
  if (todayPnl <= maxDailyLoss) {
    reasons.push(`Max daily loss hit ($${todayPnl} of -$${Math.abs(maxDailyLoss)} allowed). Stop trading for today.`);
  }
  if (todayPnl >= maxDailyProfit) {
    reasons.push(`Max daily profit target reached ($${todayPnl} of $${maxDailyProfit} target). Lock it in — stop trading for today.`);
  }
  if (currentDrawdown >= maxDrawdownAmount && maxDrawdownAmount > 0) {
    reasons.push(`Max account drawdown reached ($${currentDrawdown} of $${maxDrawdownAmount} allowed, ${drawdownPct}% of capital).`);
  }

  return {
    enabled: true,
    blocked: reasons.length > 0,
    reasons,
    todayTradeCount,
    maxTradesPerDay: g.maxTradesPerDay,
    todayPnl,
    maxDailyLoss,
    maxDailyProfit,
    currentDrawdown,
    maxDrawdownAmount,
    drawdownPct,
    maxAccountDrawdownPct: g.maxAccountDrawdownPct,
    suggestedRiskAmount,
    riskPerTradePct: g.riskPerTradePct,
    accountCapital: capital,
  };
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

module.exports = { evaluateGuardrails };
