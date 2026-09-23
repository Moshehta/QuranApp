const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../db');
const { authMiddleware, adminOnly, mainAdminOnly } = require('../middleware/auth');
const router = express.Router();

// جلب كل المستخدمين (أدمن فقط)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT id, username, name, role, isMainAdmin, createdAt FROM Users ORDER BY createdAt');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
  }
});

// جلب قائمة المُسمّعين (أدمن ومحفظ وطالب محفظ) لاختيار إمضاء المُسمّع
router.get('/examiners', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT id, name, username, role 
        FROM Users 
        WHERE role IN ('admin', 'superadmin', 'student_teacher')
        ORDER BY 
          CASE role 
            WHEN 'admin' THEN 1 
            WHEN 'superadmin' THEN 2 
            WHEN 'student_teacher' THEN 3 
            ELSE 4 
          END, name
      `);
    res.json(result.recordset);
  } catch (err) {
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
    const pool = await getPool();
    const hashed = await bcrypt.hash('123', 10);

    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .input('password', sql.NVarChar, hashed)
      .input('name', sql.NVarChar, name)
      .input('role', sql.NVarChar, role)
      .input('createdBy', sql.Int, req.user.id)
      .query(`
        INSERT INTO Users (username, password, name, role, createdBy)
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.name, INSERTED.role
        VALUES (@username, @password, @name, @role, @createdBy)
      `);

    const newUser = result.recordset[0];

    // ربط الحساب بالطلاب في حال ولي أمر أو طالب أو طالب محفظ
    if ((role === 'parent' || role === 'student' || role === 'student_teacher') && linkedStudentIds && linkedStudentIds.length > 0) {
      for (const studentId of linkedStudentIds) {
        await pool.request()
          .input('userId', sql.Int, newUser.id)
          .input('studentId', sql.Int, studentId)
          .query('INSERT INTO ParentStudents (userId, studentId) VALUES (@userId, @studentId)');
      }
    }

    res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح', user: newUser });
  } catch (err) {
    if (err.number === 2627)
      return res.status(400).json({ message: 'اسم المستخدم موجود بالفعل' });
    res.status(500).json({ message: 'خطأ في إنشاء المستخدم' });
  }
});

// تعديل مستخدم
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, role, linkedStudentIds, resetPassword } = req.body;
  const targetId = parseInt(req.params.id);

  try {
    const pool = await getPool();
    const targetUser = await pool.request()
      .input('id', sql.Int, targetId)
      .query('SELECT * FROM Users WHERE id = @id');

    if (targetUser.recordset.length === 0)
      return res.status(404).json({ message: 'المستخدم غير موجود' });

    const target = targetUser.recordset[0];

    // لا يمكن لأي شخص تعديل الأدمن الرئيسي إلا الأدمن الرئيسي نفسه
    if (target.isMainAdmin && !req.user.isMainAdmin)
      return res.status(403).json({ message: 'لا يمكن تعديل الأدمن الرئيسي' });

    // المحفظ (superadmin) لا يمكنه تعديل الأدمن
    if (req.user.role === 'superadmin' && target.role === 'admin')
      return res.status(403).json({ message: 'المحفظ لا يمكنه تعديل الأدمن' });

    // المحفظ لا يمكنه ترقية مستخدم لأدمن
    if (role === 'admin' && !req.user.isMainAdmin && req.user.role !== 'admin')
      return res.status(403).json({ message: 'غير مصرح بتعيين رتبة أدمن' });

    let updateQuery = 'UPDATE Users SET name=@name, role=@role';
    const request = pool.request()
      .input('id', sql.Int, targetId)
      .input('name', sql.NVarChar, name)
      .input('role', sql.NVarChar, role);

    if (resetPassword) {
      const hashed = await bcrypt.hash('123', 10);
      updateQuery += ', password=@password, mustChangePassword=1';
      request.input('password', sql.NVarChar, hashed);
    }

    updateQuery += ' WHERE id=@id';
    await request.query(updateQuery);

    // تحديث ربط الطلاب في حال ولي أمر أو طالب أو طالب محفظ
    if (role === 'parent' || role === 'student' || role === 'student_teacher') {
      await pool.request()
        .input('userId', sql.Int, targetId)
        .query('DELETE FROM ParentStudents WHERE userId = @userId');

      if (linkedStudentIds && linkedStudentIds.length > 0) {
        for (const studentId of linkedStudentIds) {
          await pool.request()
            .input('userId', sql.Int, targetId)
            .input('studentId', sql.Int, studentId)
            .query('INSERT INTO ParentStudents (userId, studentId) VALUES (@userId, @studentId)');
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
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Users WHERE id = @id AND isMainAdmin = 0');
    res.json({ message: 'تم حذف المستخدم' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في حذف المستخدم' });
  }
});

// جلب الطلاب المرتبطين بولي أمر
router.get('/:id/students', authMiddleware, adminOnly, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.Int, req.params.id)
      .query(`
        SELECT s.* FROM Students s
        INNER JOIN ParentStudents ps ON ps.studentId = s.id
        WHERE ps.userId = @userId
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب طلاب ولي الأمر' });
  }
});

module.exports = router;
