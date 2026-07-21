const mongoose = require('mongoose');

const DailySurveySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true },
  followed: { type: String, enum: ['yes', 'no', 'partial'], default: 'yes' },
  result: { type: String, default: '' },
  winRate: { type: Number, default: null },
  tradeCount: { type: Number, default: null },
  wins: { type: Number, default: null },
  losses: { type: Number, default: null },
  violation: { type: String, default: '' },
}, { timestamps: true });

DailySurveySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailySurvey', DailySurveySchema);
