const mongoose = require('mongoose');

const DailyBiasSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  trend: { type: String, default: 'Bullish' }, // Bullish | Bearish | Ranging
  position: { type: String, enum: ['premium', 'discount', 'middle'], default: 'middle' },
  ydHigh: { type: String, default: '' },
  ydLow: { type: String, default: '' },
  liqNotes: { type: String, default: '' },
  scenario: { type: String, enum: ['continuation', 'reversal', 'choppy'], default: 'continuation' },
  tp: { type: String, default: '' },
  invLevel: { type: String, default: '' },
  invalidated: { type: Boolean, default: false },
}, { timestamps: true });

DailyBiasSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyBias', DailyBiasSchema);
