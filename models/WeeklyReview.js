const mongoose = require('mongoose');

const WeeklyReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  weekStart: { type: String, required: true, index: true }, // Sunday, YYYY-MM-DD
  weekEnd: { type: String, required: true },

  qa: {
    missedSetupsCount: { type: Number, default: null },
    bestTradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
    bestTradeNote: { type: String, default: '' },
    worstTradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
    worstTradeNote: { type: String, default: '' },
  },

  reflection: {
    wentWell: { type: String, default: '' },
    mistakesWeaknesses: { type: String, default: '' },
    patternsNoticed: { type: String, default: '' },
    singleFocusNextWeek: { type: String, default: '' },
  },
}, { timestamps: true });

WeeklyReviewSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyReview', WeeklyReviewSchema);
