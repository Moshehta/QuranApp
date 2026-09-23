const express = require('express');
const bcrypt = require('bcryptjs');
const { getPool, sql } = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { checkSelfOrSibling } = require('../utils/siblingHelper');
const router = express.Router();

// دالة مساعدة لربط أو إنشاء حساب ولي أمر بآخر 4 أرقام
async function linkOrCreateParentUser(pool, studentId, studentName, parentName, phoneNum, label, createdBy) {
  if (!phoneNum) return;
  const cleanPhoneDigits = String(phoneNum).replace(/\D/g, '');
  if (cleanPhoneDigits.length < 4) return;
  const parentUsername = cleanPhoneDigits.slice(-4);
  const defaultPasswordHash = await bcrypt.hash('123', 10);

  try {
    const existingParent = await pool.request()
      .input('username', sql.NVarChar, parentUsername)
      .query('SELECT id FROM Users WHERE username = @username');

    let parentUserId;
    if (existingParent.recordset.length > 0) {
      parentUserId = existingParent.recordset[0].id;
    } else {
      const newParentRes = await pool.request()
        .input('username', sql.NVarChar, parentUsername)
        .input('password', sql.NVarChar, defaultPasswordHash)
        .input('name', sql.NVarChar, parentName ? `${parentName} (${label})` : `ولي أمر ${studentName} (${label})`)
        .input('role', sql.NVarChar, 'parent')
        .input('createdBy', sql.Int, createdBy || null)
        .query(`
          INSERT INTO Users (username, password, name, role, createdBy)
          OUTPUT INSERTED.id
          VALUES (@username, @password, @name, @role, @createdBy)
        `);
      parentUserId = newParentRes.recordset[0].id;
    }

    await pool.request()
      .input('userId', sql.Int, parentUserId)
      .input('studentId', sql.Int, studentId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM ParentStudents WHERE userId=@userId AND studentId=@studentId)
        INSERT INTO ParentStudents (userId, studentId) VALUES (@userId, @studentId)
      `);
  } catch (err) {
    console.error('Error in linkOrCreateParentUser:', err.message);
  }
}

// جلب كل الطلاب (أدمن وطالب محفظ يرون الكل، ولي الأمر والطالب يرون المربوط بهم)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    let query;

    if (req.user.role === 'admin' || req.user.role === 'superadmin' || req.user.role === 'student_teacher') {
      query = `SELECT * FROM Students WHERE isActive = 1 ORDER BY name`;
      const result = await pool.request().query(query);
      return res.json(result.recordset);
    }

    if (req.user.role === 'parent' || req.user.role === 'student') {
      const result = await pool.request()
        .input('userId', sql.Int, req.user.id)
        .query(`
          SELECT s.* FROM Students s
          INNER JOIN ParentStudents ps ON ps.studentId = s.id
          WHERE ps.userId = @userId AND s.isActive = 1
          ORDER BY s.name
        `);
      return res.json(result.recordset);
    }

    res.status(403).json({ message: 'غير مسموح' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في جلب الطلاب' });
  }
});

// البحث عن طالب بالكود أو الاسم
router.get('/search', authMiddleware, async (req, res) => {
  const { q } = req.query;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('q', sql.NVarChar, `%${q}%`)
      .query(`
        SELECT * FROM Students 
        WHERE isActive = 1 AND (name LIKE @q OR studentCode LIKE @q)
        ORDER BY name
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في البحث' });
  }
});

// جلب بيانات طالب واحد
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM Students WHERE id = @id AND isActive = 1');
    if (result.recordset.length === 0)
      return res.status(404).json({ message: 'الطالب غير موجود' });

    const student = result.recordset[0];

    // فحص صلاحية الطالب أو ولي الأمر
    if (req.user.role === 'student' || req.user.role === 'parent') {
      const linked = await pool.request()
        .input('userId', sql.Int, req.user.id)
        .input('studentId', sql.Int, student.id)
        .query('SELECT 1 FROM ParentStudents WHERE userId=@userId AND studentId=@studentId');
      if (linked.recordset.length === 0) {
        return res.status(403).json({ message: 'غير مصرح بعرض هذا الطالب' });
      }
    }

    // إذا كان المستخدم طالب محفظ، نفحص هل هو نفسه أو أحد إخوته لمنعه من التسميع
    let siblingCheck = { isBlocked: false, isSelf: false, isSibling: false, reason: null, message: null };
    if (req.user.role === 'student_teacher' || req.user.role === 'superadmin') {
      siblingCheck = await checkSelfOrSibling(pool, req.user.id, student.id);
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
    res.status(500).json({ message: 'خطأ في جلب بيانات الطالب' });
  }
});

// إضافة طالب جديد
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name, age, phone, parentName, parentPhone, parentName2, parentPhone2, joinDate } = req.body;
  if (!name || !age || !parentName || !parentPhone) {
    return res.status(400).json({ message: 'اسم الطالب، السن، اسم ولي الأمر 1، ورقم تليفون ولي الأمر 1 حقول إلزامية' });
  }

  try {
    const pool = await getPool();

    // توليد كود الطالب (يبدأ من 100 ويزداد تلقائياً بدون STU)
    const codesResult = await pool.request().query('SELECT studentCode FROM Students');
    let maxCode = 99; // حتى يبدأ أول طالب من 100
    for (const row of codesResult.recordset) {
      const num = parseInt(String(row.studentCode).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxCode) {
        maxCode = num;
      }
    }
    const studentCode = String(maxCode + 1);

    // 1. إضافة الطالب في جدول Students
    const studentResult = await pool.request()
      .input('studentCode', sql.NVarChar, studentCode)
      .input('name', sql.NVarChar, name)
      .input('age', sql.Int, parseInt(age) || null)
      .input('phone', sql.NVarChar, phone || null)
      .input('parentName', sql.NVarChar, parentName)
      .input('parentPhone', sql.NVarChar, parentPhone)
      .input('parentName2', sql.NVarChar, parentName2 || null)
      .input('parentPhone2', sql.NVarChar, parentPhone2 || null)
      .input('joinDate', sql.Date, joinDate || new Date())
      .query(`
        INSERT INTO Students (studentCode, name, age, phone, parentName, parentPhone, parentName2, parentPhone2, joinDate)
        OUTPUT INSERTED.*
        VALUES (@studentCode, @name, @age, @phone, @parentName, @parentPhone, @parentName2, @parentPhone2, @joinDate)
      `);

    const newStudent = studentResult.recordset[0];
    const defaultPasswordHash = await bcrypt.hash('123', 10);

    // 2. إنشاء حساب مستخدم للطالب تلقائياً (اسم المستخدم = كود الطالب، مثل 100)
    try {
      const userStudentRes = await pool.request()
        .input('username', sql.NVarChar, studentCode)
        .input('password', sql.NVarChar, defaultPasswordHash)
        .input('name', sql.NVarChar, name)
        .input('role', sql.NVarChar, 'student')
        .input('createdBy', sql.Int, req.user.id)
        .query(`
          INSERT INTO Users (username, password, name, role, createdBy)
          OUTPUT INSERTED.id
          VALUES (@username, @password, @name, @role, @createdBy)
        `);
      const studentUserId = userStudentRes.recordset[0].id;
      await pool.request()
        .input('userId', sql.Int, studentUserId)
        .input('studentId', sql.Int, newStudent.id)
        .query('INSERT INTO ParentStudents (userId, studentId) VALUES (@userId, @studentId)');
    } catch (userErr) {
      console.error('Error creating auto student user:', userErr.message);
    }

    // 3. إنشاء أو ربط حساب ولي الأمر 1
    await linkOrCreateParentUser(pool, newStudent.id, name, parentName, parentPhone, 'ولي أمر 1', req.user.id);

    // 4. إنشاء أو ربط حساب ولي الأمر 2 إن وُجد
    if (parentPhone2) {
      await linkOrCreateParentUser(pool, newStudent.id, name, parentName2 || `${name} (ولي أمر 2)`, parentPhone2, 'ولي أمر 2', req.user.id);
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
  const targetId = parseInt(req.params.id);

  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, targetId)
      .input('name', sql.NVarChar, name)
      .input('age', sql.Int, age ? parseInt(age) : null)
      .input('phone', sql.NVarChar, phone || null)
      .input('parentName', sql.NVarChar, parentName || null)
      .input('parentPhone', sql.NVarChar, parentPhone || null)
      .input('parentName2', sql.NVarChar, parentName2 || null)
      .input('parentPhone2', sql.NVarChar, parentPhone2 || null)
      .query(`
        UPDATE Students SET name=@name, age=@age, phone=@phone,
        parentName=@parentName, parentPhone=@parentPhone,
        parentName2=@parentName2, parentPhone2=@parentPhone2 WHERE id=@id
      `);

    // ربط أو إنشاء حسابات أولياء الأمور تلقائياً لو تم إدخال أرقام جديدة في التعديل
    if (parentPhone) {
      await linkOrCreateParentUser(pool, targetId, name, parentName, parentPhone, 'ولي أمر 1', req.user.id);
    }
    if (parentPhone2) {
      await linkOrCreateParentUser(pool, targetId, name, parentName2 || `${name} (ولي أمر 2)`, parentPhone2, 'ولي أمر 2', req.user.id);
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
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('UPDATE Students SET isActive = 0 WHERE id = @id');
    res.json({ message: 'تم حذف الطالب' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في حذف الطالب' });
  }
});

module.exports = router;
