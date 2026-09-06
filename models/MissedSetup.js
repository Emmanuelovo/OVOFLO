const mongoose = require('mongoose');

const MissedSetupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  planName: { type: String, default: '' },
  pair: { type: String, default: '', trim: true },
  description: { type: String, default: '' },        // what the setup was
  reasonSkipped: { type: String, default: '' },       // e.g. "hesitated", "not at desk", "fear"
}, { timestamps: true });

module.exports = mongoose.model('MissedSetup', MissedSetupSchema);