const mongoose = require('mongoose');

/**
 * One Settings document per user (unique on userId) - each account has its own
 * preferences and guardrails, fully independent of everyone else's.
 */
const SettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

  preferences: {
    defaultMarket: { type: String, enum: ['crypto', 'forex', 'commodities'], default: 'crypto' },
    defaultTfStyle: { type: String, default: 'day' },
    defaultEntryModel: { type: String, enum: ['aggressive', 'conservative'], default: 'aggressive' },
    timezone: { type: String, default: 'UTC' },
  },

  guardrails: {
    enabled: { type: Boolean, default: true },
    accountCapital: { type: Number, default: 1000 },
    maxTradesPerDay: { type: Number, default: 5 },
    maxAccountDrawdownPct: { type: Number, default: 20 },
    maxDailyLossPct: { type: Number, default: 3 },
    maxDailyProfitPct: { type: Number, default: 6 },
    riskPerTradePct: { type: Number, default: 1 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);
