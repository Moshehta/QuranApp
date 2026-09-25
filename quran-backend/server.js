const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const studentsRoutes = require('./routes/students');
const sessionsRoutes = require('./routes/sessions');
const usersRoutes = require('./routes/users');
const paymentsRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/payments', paymentsRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'مقرأة تحفيظ قرآن - API يعمل بنجاح ✓' });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ السيرفر يعمل على port ${PORT}`);
  });
}

module.exports = app;
