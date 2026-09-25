const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authMiddleware, adminOnly, mainAdminOnly } = require('../middleware/auth');
const router = express.Router();

// جلب كل المستخدمين (أدمن فقط)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await query('SELECT id, username, name, role, "isMainAdmin", "createdAt" FROM "Users" ORDER BY "createdAt"');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
  }
});

// جلب قائمة المُسمّعين (أدمن ومحفظ وطالب محفظ) لاختيار إمضاء المُسمّع
router.get('/examiners', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, username, role 
      FROM "Users" 
      WHERE role IN ('admin', 'superadmin', 'student_teacher')
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'superadmin' THEN 2 
          WHEN 'student_teacher' THEN 3 
          ELSE 4 
        END, name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في جلب قائمة المُسمّعين' });
  }
});

// إضافة مستخدم جديد (أدمن فقط)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { username, name, role, linkedStudentIds } = req.body;
  if (!username || !name || !role)
    return res.status(400).json({ message: 'جميع الحقول مطلوبة' });

  // المحفظ والآخرين لا يستطيعون إنشاء أدمن
  if (role === 'admin' && !req.user.isMainAdmin && req.user.role !== 'admin')
    return res.status(403).json({ message: 'فقط الأدمن يستطيع إنشاء أدمن' });

  try {
    const hashed = await bcrypt.hash('123', 10);

    const result = await query(`
      INSERT INTO "Users" ("username", "password", "name", "role", "createdBy")
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, name, role
    `, [username, hashed, name, role, req.user.id]);

    const newUser = result.rows[0];

    // ربط الحساب بالطلاب في حال ولي أمر أو طالب أو طالب محفظ
    if ((role === 'parent' || role === 'student' || role === 'student_teacher') && linkedStudentIds && linkedStudentIds.length > 0) {
      for (const studentId of linkedStudentIds) {
        await query(`
          INSERT INTO "ParentStudents" ("userId", "studentId")
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [newUser.id, studentId]);
      }
    }

    res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح', user: newUser });
  } catch (err) {
    console.error(err);
    // كود 23505 هو خطأ التكرار (Unique violation) في بوستجريس
    if (err.code === '23505')
      return res.status(400).json({ message: 'اسم المستخدم موجود بالفعل' });
    res.status(500).json({ message: 'خطأ في إنشاء المستخدم' });
  }
});

// تعديل مستخدم
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, role, linkedStudentIds, resetPassword } = req.body;
  const targetId = parseInt(req.params.id, 10);

  try {
    const targetUser = await query('SELECT * FROM "Users" WHERE id = $1', [targetId]);

    if (targetUser.rows.length === 0)
      return res.status(404).json({ message: 'المستخدم غير موجود' });

    const target = targetUser.rows[0];

    // لا يمكن لأي شخص تعديل الأدمن الرئيسي إلا الأدمن الرئيسي نفسه
    if (target.isMainAdmin && !req.user.isMainAdmin)
      return res.status(403).json({ message: 'لا يمكن تعديل الأدمن الرئيسي' });

    // المحفظ (superadmin) لا يمكنه تعديل الأدمن
    if (req.user.role === 'superadmin' && target.role === 'admin')
      return res.status(403).json({ message: 'المحفظ لا يمكنه تعديل الأدمن' });

    // المحفظ لا يمكنه ترقية مستخدم لأدمن
    if (role === 'admin' && !req.user.isMainAdmin && req.user.role !== 'admin')
      return res.status(403).json({ message: 'غير مصرح بتعيين رتبة أدمن' });

    let updateQuery = 'UPDATE "Users" SET "name"=$1, "role"=$2';
    const params = [name, role];

    if (resetPassword) {
      const hashed = await bcrypt.hash('123', 10);
      params.push(hashed);
      updateQuery += `, "password"=$${params.length}, "mustChangePassword"=TRUE`;
    }

    params.push(targetId);
    updateQuery += ` WHERE "id"=$${params.length}`;
    await query(updateQuery, params);

    // تحديث ربط الطلاب في حال ولي أمر أو طالب أو طالب محفظ
    if (role === 'parent' || role === 'student' || role === 'student_teacher') {
      await query('DELETE FROM "ParentStudents" WHERE "userId" = $1', [targetId]);

      if (linkedStudentIds && linkedStudentIds.length > 0) {
        for (const studentId of linkedStudentIds) {
          await query(`
            INSERT INTO "ParentStudents" ("userId", "studentId")
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [targetId, studentId]);
        }
      }
    }

    res.json({ message: 'تم تعديل بيانات المستخدم بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في تعديل المستخدم' });
  }
});

// حذف مستخدم (الأدمن الرئيسي فقط)
router.delete('/:id', authMiddleware, mainAdminOnly, async (req, res) => {
  try {
    await query('DELETE FROM "Users" WHERE "id" = $1 AND "isMainAdmin" = FALSE', [req.params.id]);
    res.json({ message: 'تم حذف المستخدم' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في حذف المستخدم' });
  }
});

// جلب الطلاب المرتبطين بمستخدم (أدمن فقط)
router.get('/:id/students', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await query(`
      SELECT s.* FROM "Students" s
      INNER JOIN "ParentStudents" ps ON ps."studentId" = s.id
      WHERE ps."userId" = $1
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في جلب طلاب المستخدم' });
  }
});

// تحديث قائمة الطلاب المسندين لمستخدم (أدمن فقط)
router.put('/:id/assignments', authMiddleware, adminOnly, async (req, res) => {
  const { studentIds } = req.body;
  const targetId = parseInt(req.params.id, 10);

  try {
    const userCheck = await query('SELECT id, name, role FROM "Users" WHERE id = $1', [targetId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // حذف التوزيع الحالي
    await query('DELETE FROM "ParentStudents" WHERE "userId" = $1', [targetId]);

    // إضافة الطلاب الجدد المحددين
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      for (const studentId of studentIds) {
        await query(`
          INSERT INTO "ParentStudents" ("userId", "studentId")
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [targetId, studentId]);
      }
    }

    res.json({ message: 'تم تحديث توزيع الطلاب بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في تحديث توزيع الطلاب' });
  }
});

module.exports = router;
