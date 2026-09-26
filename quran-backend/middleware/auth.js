const jwt = require('jsonwebtoken');
const { query } = require('../db');

async function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'غير مصرح' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'quran_app_secret_key_2024');

    // التحقق الفوري من وجود المستخدم في قاعدة البيانات وعدم حذفه
    const userRes = await query('SELECT id, username, name, role, "isMainAdmin" FROM "Users" WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ message: 'تم حذف هذا الحساب، يرجى تسجيل الدخول مجدداً' });
    }

    req.user = userRes.rows[0];
    next();
  } catch {
    res.status(401).json({ message: 'رمز المصادقة غير صالح' });
  }
}

function adminOnly(req, res, next) {
  console.log('[DEBUG adminOnly] req.user:', req.user);
  if (req.user && (req.user.isMainAdmin || req.user.role === 'admin' || req.user.role === 'superadmin')) {
    return next();
  }
  return res.status(403).json({ message: 'غير مسموح - أدمن فقط' });
}

function mainAdminOnly(req, res, next) {
  if (!req.user.isMainAdmin)
    return res.status(403).json({ message: 'غير مسموح - الأدمن الرئيسي فقط' });
  next();
}

module.exports = { authMiddleware, adminOnly, mainAdminOnly };
