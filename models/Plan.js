const mongoose = require('mongoose');

const ChecklistItem = new mongoose.Schema({
  label: { type: String, default: '' },
  checked: { type: Boolean, default: false },
}, { _id: true });

const TradeMgmtItem = new mongoose.Schema({
  label: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
}, { _id: true });

const PlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, default: 'Untitled Plan' },
  market: { type: String, enum: ['crypto', 'forex', 'commodities'], default: 'crypto' },

  // Step 1-5 charting process checklist
  chartingProcess: { type: [ChecklistItem], default: () => ([
    { label: 'Identify HTF Trend + Market Structure', checked: false },
    { label: 'Are we in a Buy or Supply Zone', checked: false },
    { label: 'Define S & D Zones based on Step 2', checked: false },
    { label: 'Mark the Point of Interest (POI)', checked: false },
    { label: 'Look for entry criteria within POI', checked: false },
  ]) },

  // POI entry criteria
  poi: { type: [ChecklistItem], default: () => ([
    { label: 'Liquidity Sweep (Above or Below Continuation or Pullback zone)', checked: false },
    { label: 'Market Shift (only facilitates Pullback, not Break of Structural High/Low)', checked: false },
  ]) },

  entryModel: { type: String, enum: ['aggressive', 'conservative'], default: 'aggressive' },
  entryModelNotes: {
    aggressive: { type: String, default: 'Entry after BOS + Liquidity Sweep above/below + Pullback' },
    conservative: { type: String, default: 'Entry after BOS + Liquidity Sweep above/below + Pullback' },
  },

  exit: {
    sl: { type: String, default: 'SL Above or Below LTF S&D zone within POI' },
    tp: { type: String, default: 'TP at Opposing LTF S&D zone' },
  },

  tradeMgmt: { type: [TradeMgmtItem], default: () => ([
    { label: 'Only Full TP', enabled: true },
    { label: 'Set and Forget', enabled: true },
    { label: 'No Partials', enabled: true },
    { label: 'If price moves 50%+ beyond entry, move SL to Break Even', enabled: true },
  ]) },

  tfStyle: { type: String, default: 'day' }, // scalp | day | swing | custom
  customTf: {
    htf: { type: String, default: '' },
    mtf: { type: String, default: '' },
    ltf: { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('Plan', PlanSchema);
