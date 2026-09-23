const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../db');
const router = express.Router();

// تسجيل الدخول
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'أدخل اسم المستخدم وكلمة المرور' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT * FROM Users WHERE username = @username');

    if (result.recordset.length === 0)
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    const token = jwt.sign(
      { id: user.id, role: user.role, isMainAdmin: user.isMainAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isMainAdmin: user.isMainAdmin,
        mustChangePassword: user.mustChangePassword,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// تغيير كلمة المرور
router.post('/change-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, userId)
      .input('password', sql.NVarChar, hashed)
      .query('UPDATE Users SET password = @password, mustChangePassword = 0 WHERE id = @id');
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في تغيير كلمة المرور' });
  }
});

module.exports = router;
