const mongoose = require('mongoose');

const MissedSetupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  planName: { type: String, default: '' },
  description: { type: String, default: '' },
  reasonSkipped: { type: String, default: '' }, // e.g. "hesitated", "not at desk", "fear"
}, { timestamps: true });

module.exports = mongoose.model('MissedSetup', MissedSetupSchema);
