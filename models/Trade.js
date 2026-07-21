const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  planName: { type: String, default: '' },

  outcome: { type: String, enum: ['win', 'loss', 'breakeven'], required: true },
  pnl: { type: Number, default: 0 },
  riskAmount: { type: Number, default: 0 }, // $ risked on this trade, used to derive R multiple
  rMultiple: { type: Number, default: 0 },  // pnl / riskAmount, computed server-side

  followedPlan: { type: Boolean, default: true },
  ruleBroken: { type: Boolean, default: false },
  ruleBrokenNotes: { type: String, default: '' },
  fomoTrade: { type: Boolean, default: false },
  missedSetup: { type: Boolean, default: false }, // this specific entry represents a missed/skipped setup

  confluences: { type: String, default: '' },
  tradeMgmtNotes: { type: String, default: '' },
  mistakes: { type: String, default: '' },

  entryEmotion: { type: String, default: '' },
  exitEmotion: { type: String, default: '' },

  htfLink: { type: String, default: '' },
  mtfLink: { type: String, default: '' },
  ltfLink: { type: String, default: '' },
}, { timestamps: true });

TradeSchema.index({ userId: 1, date: 1, createdAt: 1 });

module.exports = mongoose.model('Trade', TradeSchema);
