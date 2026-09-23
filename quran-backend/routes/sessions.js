const express = require('express');
const { getPool, sql } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { checkSelfOrSibling } = require('../utils/siblingHelper');
const router = express.Router();

// جلب جلسات طالب مع فلتر زمني
router.get('/student/:studentId', authMiddleware, async (req, res) => {
  const { studentId } = req.params;
  const { months } = req.query;

  // الطالب أو ولي الأمر يقدر يشوف فقط أبناءه أو نفسه
  if (req.user.role === 'student' || req.user.role === 'parent') {
    const pool = await getPool();
    const linked = await pool.request()
      .input('userId', sql.Int, req.user.id)
      .input('studentId', sql.Int, studentId)
      .query('SELECT 1 FROM ParentStudents WHERE userId=@userId AND studentId=@studentId');
    if (linked.recordset.length === 0)
      return res.status(403).json({ message: 'غير مسموح' });
  }

  try {
    const pool = await getPool();
    let query;
    if (months === 'last2') {
      // آخر جلستين مرتبين تصاعدياً من الأقدم للأحدث
      query = `
        SELECT * FROM (
          SELECT TOP 2 * FROM Sessions
          WHERE studentId = @studentId
          ORDER BY sessionDate DESC, id DESC
        ) sub
        ORDER BY sessionDate ASC, id ASC
      `;
    } else {
      let dateFilter = '';
      if (months && months !== 'all') {
        dateFilter = `AND sessionDate >= DATEADD(MONTH, -${parseInt(months)}, GETDATE())`;
      }
      query = `
        SELECT * FROM Sessions
        WHERE studentId = @studentId ${dateFilter}
        ORDER BY sessionDate ASC, id ASC
      `;
    }

    const result = await pool.request()
      .input('studentId', sql.Int, studentId)
      .query(query);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب الجلسات' });
  }
});

// تسجيل تسميع الماضي (متاح للأدمن وللطالب المحفظ مع حظر النفس والإخوة)
router.post('/:id/madi', authMiddleware, async (req, res) => {
  const isExaminer = req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'student_teacher';
  if (!isExaminer) {
    return res.status(403).json({ message: 'غير مصرح لك بتسميع الماضي' });
  }

  const sessionId = parseInt(req.params.id, 10);
  const { madiMistakes, madiFormations, madiHeardBy, madiHeardByName, madiGrade } = req.body;

  try {
    const pool = await getPool();

    // 1. جلب بيانات الجلسة للتأكد من الطالب
    const sessionRes = await pool.request()
      .input('id', sql.Int, sessionId)
      .query('SELECT * FROM Sessions WHERE id = @id');

    if (sessionRes.recordset.length === 0) {
      return res.status(404).json({ message: 'الجلسة غير موجودة' });
    }

    const session = sessionRes.recordset[0];

    // 2. إذا كان المُسمّع طالب محفظ، نتأكد أنه ليس نفسه أو أحد إخوته
    if (req.user.role === 'student_teacher' || req.user.role === 'superadmin') {
      const siblingCheck = await checkSelfOrSibling(pool, req.user.id, session.studentId);
      if (siblingCheck.isBlocked) {
        return res.status(403).json({
          message: siblingCheck.reason === 'self'
            ? 'غير مسموح لك بتسميع الماضي لنفسك'
            : 'غير مسموح لك بتسميع الماضي لأخيك أو أختك'
        });
      }
    }

    // 3. تحديد المُسمّع
    const finalHeardBy = madiHeardBy || req.user.id;
    const finalHeardByName = madiHeardByName || req.user.name;

    // 4. التحديث في قاعدة البيانات
    const request = pool.request()
      .input('id', sql.Int, sessionId)
      .input('madiMistakes', sql.Int, madiMistakes !== undefined && madiMistakes !== '' ? parseInt(madiMistakes, 10) : null)
      .input('madiFormations', sql.Int, madiFormations !== undefined && madiFormations !== '' ? parseInt(madiFormations, 10) : null)
      .input('madiHeardBy', sql.Int, finalHeardBy)
      .input('madiHeardByName', sql.NVarChar, finalHeardByName);

    let updateSql = `
      UPDATE Sessions SET
        madiMistakes = @madiMistakes,
        madiFormations = @madiFormations,
        madiHeardBy = @madiHeardBy,
        madiHeardByName = @madiHeardByName
    `;

    // فقط الأدمن له صلاحية وضع التقدير النهائي
    if (req.user.role === 'admin' && madiGrade !== undefined) {
      request.input('madiGrade', sql.NVarChar, madiGrade || null);
      updateSql += `, madiGrade = @madiGrade`;
    }

    updateSql += ` WHERE id = @id`;
    await request.query(updateSql);

    res.json({ message: 'تم حفظ تسميع الماضي بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في حفظ تسميع الماضي' });
  }
});

// إضافة جلسة جديدة (أدمن فقط)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const {
    studentId, sessionDate,
    lawhText, lawhGrade,
    sihhaText,
    madiText, madiGrade, madiMistakes, madiFormations, madiHeardBy, madiHeardByName, notes
  } = req.body;

  if (!studentId || !sessionDate)
    return res.status(400).json({ message: 'الطالب والتاريخ مطلوبان' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('studentId', sql.Int, studentId)
      .input('sessionDate', sql.Date, sessionDate)
      .input('lawhText', sql.NVarChar, lawhText || null)
      .input('lawhGrade', sql.NVarChar, lawhGrade || null)
      .input('sihhaText', sql.NVarChar, sihhaText || null)
      .input('madiText', sql.NVarChar, madiText || null)
      .input('madiGrade', sql.NVarChar, madiGrade || null)
      .input('madiMistakes', sql.Int, madiMistakes !== undefined && madiMistakes !== '' ? parseInt(madiMistakes, 10) : null)
      .input('madiFormations', sql.Int, madiFormations !== undefined && madiFormations !== '' ? parseInt(madiFormations, 10) : null)
      .input('madiHeardBy', sql.Int, madiHeardBy || null)
      .input('madiHeardByName', sql.NVarChar, madiHeardByName || null)
      .input('notes', sql.NVarChar, notes || null)
      .input('createdBy', sql.Int, req.user.id)
      .query(`
        INSERT INTO Sessions (
          studentId, sessionDate,
          lawhText, lawhGrade,
          sihhaText,
          madiText, madiGrade, madiMistakes, madiFormations, madiHeardBy, madiHeardByName,
          notes, createdBy
        )
        OUTPUT INSERTED.*
        VALUES (
          @studentId, @sessionDate,
          @lawhText, @lawhGrade,
          @sihhaText,
          @madiText, @madiGrade, @madiMistakes, @madiFormations, @madiHeardBy, @madiHeardByName,
          @notes, @createdBy
        )
      `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في إضافة الجلسة' });
  }
});

// تعديل جلسة (أدمن فقط)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const {
    sessionDate,
    lawhText, lawhGrade,
    sihhaText,
    madiText, madiGrade, madiMistakes, madiFormations, madiHeardBy, madiHeardByName, notes
  } = req.body;

  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('sessionDate', sql.Date, sessionDate)
      .input('lawhText', sql.NVarChar, lawhText || null)
      .input('lawhGrade', sql.NVarChar, lawhGrade || null)
      .input('sihhaText', sql.NVarChar, sihhaText || null)
      .input('madiText', sql.NVarChar, madiText || null)
      .input('madiGrade', sql.NVarChar, madiGrade || null)
      .input('madiMistakes', sql.Int, madiMistakes !== undefined && madiMistakes !== '' ? parseInt(madiMistakes, 10) : null)
      .input('madiFormations', sql.Int, madiFormations !== undefined && madiFormations !== '' ? parseInt(madiFormations, 10) : null)
      .input('madiHeardBy', sql.Int, madiHeardBy || null)
      .input('madiHeardByName', sql.NVarChar, madiHeardByName || null)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        UPDATE Sessions SET
          sessionDate=@sessionDate,
          lawhText=@lawhText,
          lawhGrade=@lawhGrade,
          sihhaText=@sihhaText,
          madiText=@madiText, madiGrade=@madiGrade,
          madiMistakes=@madiMistakes, madiFormations=@madiFormations,
          madiHeardBy=@madiHeardBy, madiHeardByName=@madiHeardByName,
          notes=@notes
        WHERE id=@id
      `);
    res.json({ message: 'تم تعديل الجلسة' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في تعديل الجلسة' });
  }
});

// حذف جلسة (أدمن فقط)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Sessions WHERE id = @id');
    res.json({ message: 'تم حذف الجلسة' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في حذف الجلسة' });
  }
});

module.exports = router;

