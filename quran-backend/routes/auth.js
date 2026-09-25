const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const router = express.Router();

// تسجيل الدخول
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'أدخل اسم المستخدم وكلمة المرور' });

  try {
    const result = await query('SELECT * FROM "Users" WHERE "username" = $1', [username]);

    if (result.rows.length === 0)
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    const user = result.rows[0];
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
    res.status(500).json({ message: 'خطأ في الخادم', error: err.message });
  }
});

// تغيير كلمة المرور
router.post('/change-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await query('UPDATE "Users" SET "password" = $1, "mustChangePassword" = false WHERE "id" = $2', [hashed, userId]);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في تغيير كلمة المرور' });
  }
});

module.exports = router;
