require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');

const app = express();
connectDB();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Create a .env file (see .env.example) with a long random JWT_SECRET.');
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/trades', require('./routes/trades'));
app.use('/api/bias', require('./routes/bias'));
app.use('/api/surveys', require('./routes/surveys'));
app.use('/api/meditation', require('./routes/meditation'));
app.use('/api/missed-setups', require('./routes/missedSetups'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/guardrails', require('./routes/guardrails'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/news', require('./routes/news'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// SPA fallback - anything not /api goes to the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OvoWorks Trading Suite running on port ${PORT}`));
