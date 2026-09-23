const express = require('express');
const { query } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const router = express.Router();

// جلب مدفوعات طالب
router.get('/student/:studentId', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM "Payments" WHERE "studentId" = $1 ORDER BY "paymentYear" DESC, "paymentMonth" DESC`,
      [req.params.studentId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب المدفوعات' });
  }
});

// تحديث حالة الدفع (أدمن فقط)
router.post('/toggle', authMiddleware, adminOnly, async (req, res) => {
  const { studentId, paymentYear, paymentMonth, isPaid } = req.body;
  try {
    const paidDate = isPaid ? new Date() : null;
    await query(`
      INSERT INTO "Payments" ("studentId", "paymentYear", "paymentMonth", "isPaid", "paidDate", "updatedBy", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT ("studentId", "paymentYear", "paymentMonth")
      DO UPDATE SET
        "isPaid" = EXCLUDED."isPaid",
        "paidDate" = EXCLUDED."paidDate",
        "updatedBy" = EXCLUDED."updatedBy",
        "updatedAt" = CURRENT_TIMESTAMP
    `, [studentId, paymentYear, paymentMonth, Boolean(isPaid), paidDate, req.user.id]);

    res.json({ message: 'تم تحديث حالة الدفع' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في تحديث حالة الدفع' });
  }
});

module.exports = router;
