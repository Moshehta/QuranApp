const express = require('express');
const { getPool, sql } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const router = express.Router();

// جلب مدفوعات طالب
router.get('/student/:studentId', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('studentId', sql.Int, req.params.studentId)
      .query(`
        SELECT * FROM Payments WHERE studentId = @studentId
        ORDER BY paymentYear DESC, paymentMonth DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب المدفوعات' });
  }
});

// تحديث حالة الدفع (أدمن فقط)
router.post('/toggle', authMiddleware, adminOnly, async (req, res) => {
  const { studentId, paymentYear, paymentMonth, isPaid } = req.body;
  try {
    const pool = await getPool();
    // إضافة أو تحديث
    await pool.request()
      .input('studentId', sql.Int, studentId)
      .input('paymentYear', sql.Int, paymentYear)
      .input('paymentMonth', sql.Int, paymentMonth)
      .input('isPaid', sql.Bit, isPaid ? 1 : 0)
      .input('paidDate', sql.DateTime, isPaid ? new Date() : null)
      .input('updatedBy', sql.Int, req.user.id)
      .query(`
        MERGE Payments AS target
        USING (SELECT @studentId AS studentId, @paymentYear AS paymentYear, @paymentMonth AS paymentMonth) AS source
        ON target.studentId = source.studentId AND target.paymentYear = source.paymentYear AND target.paymentMonth = source.paymentMonth
        WHEN MATCHED THEN
          UPDATE SET isPaid = @isPaid, paidDate = @paidDate, updatedBy = @updatedBy, updatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (studentId, paymentYear, paymentMonth, isPaid, paidDate, updatedBy)
          VALUES (@studentId, @paymentYear, @paymentMonth, @isPaid, @paidDate, @updatedBy);
      `);
    res.json({ message: 'تم تحديث حالة الدفع' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في تحديث حالة الدفع' });
  }
});

module.exports = router;
