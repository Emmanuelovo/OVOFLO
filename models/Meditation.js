const mongoose = require('mongoose');

const MeditationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true, index: true },
  time: { type: String, default: '' },
  durationMin: { type: Number, default: 3 },
  pre: { type: String, default: '' },
  moodBefore: { type: Number, default: 3 },
  moodAfter: { type: Number, default: 4 },
  post: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Meditation', MeditationSchema);
