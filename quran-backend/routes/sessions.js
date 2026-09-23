const express = require('express');
const { query } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { checkSelfOrSibling } = require('../utils/siblingHelper');
const router = express.Router();

// جلب جلسات طالب مع فلتر زمني
router.get('/student/:studentId', authMiddleware, async (req, res) => {
  const { studentId } = req.params;
  const { months } = req.query;

  // الطالب أو ولي الأمر يقدر يشوف فقط أبناءه أو نفسه
  if (req.user.role === 'student' || req.user.role === 'parent') {
    const linked = await query('SELECT 1 FROM "ParentStudents" WHERE "userId" = $1 AND "studentId" = $2', [req.user.id, studentId]);
    if (linked.rows.length === 0)
      return res.status(403).json({ message: 'غير مسموح' });
  }

  try {
    let result;
    if (months === 'last2') {
      // آخر جلستين مرتبين تصاعدياً من الأقدم للأحدث
      result = await query(`
        SELECT * FROM (
          SELECT * FROM "Sessions"
          WHERE "studentId" = $1
          ORDER BY "sessionDate" DESC, "id" DESC
          LIMIT 2
        ) sub
        ORDER BY "sessionDate" ASC, "id" ASC
      `, [studentId]);
    } else {
      let dateFilter = '';
      const params = [studentId];
      if (months && months !== 'all') {
        params.push(parseInt(months, 10));
        dateFilter = `AND "sessionDate" >= CURRENT_DATE - ($2 || ' months')::interval`;
      }
      result = await query(`
        SELECT * FROM "Sessions"
        WHERE "studentId" = $1 ${dateFilter}
        ORDER BY "sessionDate" ASC, "id" ASC
      `, params);
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
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
    // 1. جلب بيانات الجلسة للتأكد من الطالب
    const sessionRes = await query('SELECT * FROM "Sessions" WHERE "id" = $1', [sessionId]);

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ message: 'الجلسة غير موجودة' });
    }

    const session = sessionRes.rows[0];

    // 2. إذا كان المُسمّع طالب محفظ، نتأكد أنه ليس نفسه أو أحد إخوته
    if (req.user.role === 'student_teacher' || req.user.role === 'superadmin') {
      const siblingCheck = await checkSelfOrSibling(null, req.user.id, session.studentId);
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

    const parsedMistakes = madiMistakes !== undefined && madiMistakes !== '' ? parseInt(madiMistakes, 10) : null;
    const parsedFormations = madiFormations !== undefined && madiFormations !== '' ? parseInt(madiFormations, 10) : null;

    const params = [parsedMistakes, parsedFormations, finalHeardBy, finalHeardByName];
    let updateSql = `
      UPDATE "Sessions" SET
        "madiMistakes" = $1,
        "madiFormations" = $2,
        "madiHeardBy" = $3,
        "madiHeardByName" = $4
    `;

    // فقط الأدمن له صلاحية وضع التقدير النهائي
    if (req.user.role === 'admin' && madiGrade !== undefined) {
      params.push(madiGrade || null);
      updateSql += `, "madiGrade" = $${params.length}`;
    }

    params.push(sessionId);
    updateSql += ` WHERE "id" = $${params.length}`;

    await query(updateSql, params);

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
    const result = await query(`
      INSERT INTO "Sessions" (
        "studentId", "sessionDate",
        "lawhText", "lawhGrade",
        "sihhaText",
        "madiText", "madiGrade", "madiMistakes", "madiFormations", "madiHeardBy", "madiHeardByName",
        "notes", "createdBy"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      studentId,
      sessionDate,
      lawhText || null,
      lawhGrade || null,
      sihhaText || null,
      madiText || null,
      madiGrade || null,
      madiMistakes !== undefined && madiMistakes !== '' ? parseInt(madiMistakes, 10) : null,
      madiFormations !== undefined && madiFormations !== '' ? parseInt(madiFormations, 10) : null,
      madiHeardBy || null,
      madiHeardByName || null,
      notes || null,
      req.user.id
    ]);

    res.status(201).json(result.rows[0]);
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
    await query(`
      UPDATE "Sessions" SET
        "sessionDate" = $1,
        "lawhText" = $2,
        "lawhGrade" = $3,
        "sihhaText" = $4,
        "madiText" = $5,
        "madiGrade" = $6,
        "madiMistakes" = $7,
        "madiFormations" = $8,
        "madiHeardBy" = $9,
        "madiHeardByName" = $10,
        "notes" = $11
      WHERE "id" = $12
    `, [
      sessionDate,
      lawhText || null,
      lawhGrade || null,
      sihhaText || null,
      madiText || null,
      madiGrade || null,
      madiMistakes !== undefined && madiMistakes !== '' ? parseInt(madiMistakes, 10) : null,
      madiFormations !== undefined && madiFormations !== '' ? parseInt(madiFormations, 10) : null,
      madiHeardBy || null,
      madiHeardByName || null,
      notes || null,
      req.params.id
    ]);

    res.json({ message: 'تم تعديل الجلسة' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في تعديل الجلسة' });
  }
});

// حذف جلسة (أدمن فقط)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query('DELETE FROM "Sessions" WHERE "id" = $1', [req.params.id]);
    res.json({ message: 'تم حذف الجلسة' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في حذف الجلسة' });
  }
});

module.exports = router;
