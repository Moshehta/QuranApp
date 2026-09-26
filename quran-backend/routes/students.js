const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { checkSelfOrSibling } = require('../utils/siblingHelper');
const router = express.Router();

// دالة مساعدة لربط أو إنشاء حساب ولي أمر بآخر 4 أرقام
async function linkOrCreateParentUser(studentId, studentName, parentName, phoneNum, label, createdBy) {
  if (!phoneNum) return;
  const cleanPhoneDigits = String(phoneNum).replace(/\D/g, '');
  if (cleanPhoneDigits.length < 4) return;
  const parentUsername = cleanPhoneDigits.slice(-4);
  const defaultPasswordHash = await bcrypt.hash('123', 10);

  try {
    const existingParent = await query('SELECT id FROM "Users" WHERE "username" = $1', [parentUsername]);

    let parentUserId;
    if (existingParent.rows.length > 0) {
      parentUserId = existingParent.rows[0].id;
    } else {
      const newParentRes = await query(`
        INSERT INTO "Users" ("username", "password", "name", "role", "createdBy")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        parentUsername,
        defaultPasswordHash,
        parentName ? `${parentName} (${label})` : `ولي أمر ${studentName} (${label})`,
        'parent',
        createdBy || null
      ]);
      parentUserId = newParentRes.rows[0].id;
    }

    await query(`
      INSERT INTO "ParentStudents" ("userId", "studentId")
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [parentUserId, studentId]);
  } catch (err) {
    console.error('Error in linkOrCreateParentUser:', err.message);
  }
}

// جلب كل الطلاب (أدمن وطالب محفظ يرون الكل، ولي الأمر والطالب يرون المربوط بهم)
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      const result = await query('SELECT * FROM "Students" WHERE "isActive" = TRUE ORDER BY "name"');
      return res.json(result.rows);
    }

    // جلب الطلاب المسندين للمستخدم في ParentStudents
    const linked = await query(`
      SELECT s.* FROM "Students" s
      INNER JOIN "ParentStudents" ps ON ps."studentId" = s.id
      WHERE ps."userId" = $1 AND s."isActive" = TRUE
      ORDER BY s."name"
    `, [req.user.id]);

    // إذا كان طالب محفظ:
    // إذا تم تحديد طلاب له في ParentStudents -> يرى فقط الطلاب المحددين له
    // إذا لم يتم تحديد أي طالب له -> يرى كل الطلاب تلقائياً (الوضع الافتراضي)
    if (req.user.role === 'student_teacher') {
      if (linked.rows.length > 0) {
        return res.json(linked.rows);
      }
      const allResult = await query('SELECT * FROM "Students" WHERE "isActive" = TRUE ORDER BY "name"');
      return res.json(allResult.rows);
    }

    if (req.user.role === 'parent' || req.user.role === 'student') {
      return res.json(linked.rows);
    }

    res.status(403).json({ message: 'غير مسموح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في جلب الطلاب' });
  }
});

// البحث عن طالب بالكود أو الاسم
router.get('/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  try {
    const result = await query(`
      SELECT * FROM "Students" 
      WHERE "isActive" = TRUE AND ("name" ILIKE $1 OR "studentCode" ILIKE $1)
      ORDER BY "name"
    `, [`%${q}%`]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في البحث' });
  }
});

// جلب بيانات طالب واحد
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM "Students" WHERE "id" = $1 AND "isActive" = TRUE', [req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ message: 'الطالب غير موجود' });

    const student = result.rows[0];

    // فحص صلاحية الطالب أو ولي الأمر أو الطالب المحفظ المقيد
    if (req.user.role === 'student' || req.user.role === 'parent') {
      const linked = await query('SELECT 1 FROM "ParentStudents" WHERE "userId" = $1 AND "studentId" = $2', [req.user.id, student.id]);
      if (linked.rows.length === 0) {
        return res.status(403).json({ message: 'غير مصرح بعرض هذا الطالب' });
      }
    } else if (req.user.role === 'student_teacher') {
      // لو كان الطالب المحفظ مسند له طلاب محددين، نتأكد إنه مصرح له بهذا الطالب
      const hasSpecific = await query('SELECT 1 FROM "ParentStudents" WHERE "userId" = $1 LIMIT 1', [req.user.id]);
      if (hasSpecific.rows.length > 0) {
        const linked = await query('SELECT 1 FROM "ParentStudents" WHERE "userId" = $1 AND "studentId" = $2', [req.user.id, student.id]);
        if (linked.rows.length === 0) {
          return res.status(403).json({ message: 'غير مصرح بعرض هذا الطالب' });
        }
      }
    }

    // إذا كان المستخدم طالب محفظ، نفحص هل هو نفسه أو أحد إخوته لمنعه من التسميع
    let siblingCheck = { isBlocked: false, isSelf: false, isSibling: false, reason: null, message: null };
    if (req.user.role === 'student_teacher' || req.user.role === 'superadmin') {
      siblingCheck = await checkSelfOrSibling(null, req.user.id, student.id);
    }

    res.json({
      ...student,
      isSelfOrSibling: siblingCheck.isBlocked,
      isSelf: siblingCheck.isSelf,
      isSibling: siblingCheck.isSibling,
      blockReason: siblingCheck.reason,
      blockMessage: siblingCheck.message
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في جلب بيانات الطالب' });
  }
});

// إضافة طالب جديد
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name, age, phone, parentName, parentPhone, parentName2, parentPhone2, joinDate } = req.body;
  if (!name || !age || !parentName || !parentPhone) {
    return res.status(400).json({ message: 'اسم الطالب، السن، اسم ولي الأمر 1، ورقم تليفون ولي الأمر 1 حقول إلزامية' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (!req.user.isMainAdmin && joinDate && joinDate < todayStr) {
    return res.status(400).json({ message: 'لا يمكن تسجيل تاريخ انضمام سابق، مسموح فقط للأدمن الرئيسي' });
  }

  try {
    // توليد كود الطالب (يبدأ من 100 ويزداد تلقائياً)
    const codesResult = await query('SELECT "studentCode" FROM "Students"');
    let maxCode = 99;
    for (const row of codesResult.rows) {
      const num = parseInt(String(row.studentCode).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxCode) {
        maxCode = num;
      }
    }
    const studentCode = String(maxCode + 1);

    // 1. إضافة الطالب في جدول Students
    const studentResult = await query(`
      INSERT INTO "Students" ("studentCode", "name", "age", "phone", "parentName", "parentPhone", "parentName2", "parentPhone2", "joinDate")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      studentCode,
      name,
      parseInt(age, 10) || null,
      phone || null,
      parentName,
      parentPhone,
      parentName2 || null,
      parentPhone2 || null,
      joinDate || new Date()
    ]);

    const newStudent = studentResult.rows[0];
    const defaultPasswordHash = await bcrypt.hash('123', 10);

    // 2. إنشاء حساب مستخدم للطالب تلقائياً (اسم المستخدم = كود الطالب)
    try {
      const userStudentRes = await query(`
        INSERT INTO "Users" ("username", "password", "name", "role", "createdBy")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [studentCode, defaultPasswordHash, name, 'student', req.user.id]);

      const studentUserId = userStudentRes.rows[0].id;
      await query(`
        INSERT INTO "ParentStudents" ("userId", "studentId")
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [studentUserId, newStudent.id]);
    } catch (userErr) {
      console.error('Error creating auto student user:', userErr.message);
    }

    // 3. إنشاء أو ربط حساب ولي الأمر 1
    await linkOrCreateParentUser(newStudent.id, name, parentName, parentPhone, 'ولي أمر 1', req.user.id);

    // 4. إنشاء أو ربط حساب ولي الأمر 2 إن وُجد
    if (parentPhone2) {
      await linkOrCreateParentUser(newStudent.id, name, parentName2 || `${name} (ولي أمر 2)`, parentPhone2, 'ولي أمر 2', req.user.id);
    }

    res.status(201).json(newStudent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في إضافة الطالب' });
  }
});

// تعديل بيانات طالب
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, age, phone, parentName, parentPhone, parentName2, parentPhone2 } = req.body;
  const targetId = parseInt(req.params.id, 10);

  try {
    await query(`
      UPDATE "Students" SET
        "name" = $1, "age" = $2, "phone" = $3,
        "parentName" = $4, "parentPhone" = $5,
        "parentName2" = $6, "parentPhone2" = $7
      WHERE "id" = $8
    `, [
      name,
      age ? parseInt(age, 10) : null,
      phone || null,
      parentName || null,
      parentPhone || null,
      parentName2 || null,
      parentPhone2 || null,
      targetId
    ]);

    // ربط أو إنشاء حسابات أولياء الأمور تلقائياً لو تم إدخال أرقام جديدة في التعديل
    if (parentPhone) {
      await linkOrCreateParentUser(targetId, name, parentName, parentPhone, 'ولي أمر 1', req.user.id);
    }
    if (parentPhone2) {
      await linkOrCreateParentUser(targetId, name, parentName2 || `${name} (ولي أمر 2)`, parentPhone2, 'ولي أمر 2', req.user.id);
    }

    res.json({ message: 'تم تحديث بيانات الطالب وحسابات المتابعة بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في تعديل بيانات الطالب' });
  }
});

// حذف طالب (إخفاء فقط)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await query('UPDATE "Students" SET "isActive" = FALSE WHERE "id" = $1', [req.params.id]);
    res.json({ message: 'تم حذف الطالب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في حذف الطالب' });
  }
});

module.exports = router;
