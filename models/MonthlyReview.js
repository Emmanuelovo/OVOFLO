const mongoose = require('mongoose');

const MonthlyReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12

  processScore: { type: Number, min: 0, max: 10, default: null },
  processScoreNotes: { type: String, default: '' },

  qa: {
    missedSetupsCount: { type: Number, default: null },
  },

  reflection: {
    bestTradeWinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
    bestTradeWinNote: { type: String, default: '' },
    bestTradeLossId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
    bestTradeLossNote: { type: String, default: '' },
    mentalBarrier: { type: String, default: '' },
    fixPlan: { type: String, default: '' },
    mostProud: { type: String, default: '' },
    singleFocusNextMonth: { type: String, default: '' },
  },
}, { timestamps: true });

MonthlyReviewSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyReview', MonthlyReviewSchema);
