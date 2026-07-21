const mongoose = require('mongoose');

const QuarterlyReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  year: { type: Number, required: true },
  quarter: { type: Number, required: true, min: 1, max: 4 }, // Q1 Jan-Mar ... Q4 Oct-Dec

  reflection: {
    wentWell: { type: String, default: '' },
    mistakes: { type: String, default: '' },
    patterns: { type: String, default: '' },
    biggestLesson: { type: String, default: '' },
    singleFocusNextQuarter: { type: String, default: '' },
  },
}, { timestamps: true });

QuarterlyReviewSchema.index({ userId: 1, year: 1, quarter: 1 }, { unique: true });

module.exports = mongoose.model('QuarterlyReview', QuarterlyReviewSchema);
