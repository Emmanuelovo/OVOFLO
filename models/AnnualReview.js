const mongoose = require('mongoose');

const AnnualReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  year: { type: Number, required: true },

  deepReflection: {
    biggestWinTradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
    biggestWinNote: { type: String, default: '' },
    biggestLossTradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
    biggestLossNote: { type: String, default: '' },
    growthAreas: { type: String, default: '' },
    mentalGameEvolution: { type: String, default: '' },
    systemsImprovements: { type: String, default: '' },
    mostProud: { type: String, default: '' },
    gratitude: { type: String, default: '' },
    nextYearVision: { type: String, default: '' },
    singleFocusNextYear: { type: String, default: '' },
    freeform: { type: String, default: '' },
  },
}, { timestamps: true });

AnnualReviewSchema.index({ userId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('AnnualReview', AnnualReviewSchema);
