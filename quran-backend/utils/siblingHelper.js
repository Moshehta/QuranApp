const { sql } = require('../db');

function cleanPhone(p) {
  if (!p) return '';
  return String(p).replace(/\D/g, '');
}

/**
 * دالة للتحقق هل الطالب المستهدف هو نفسه الطالب المحفظ أو أحد إخوته (الأشقاء)
 * @param {object} pool - SQL pool
 * @param {number} userId - معرّف المستخدم الحالي
 * @param {number} targetStudentId - معرّف الطالب المستهدف التسميع له
 */
async function checkSelfOrSibling(pool, userId, targetStudentId) {
  const targetId = parseInt(targetStudentId, 10);
  if (isNaN(targetId)) {
    return { isSelf: false, isSibling: false, isBlocked: false, myStudentId: null, reason: null };
  }

  // 1. جلب الطالب المربوط بحساب هذا المستخدم (في حال كان طالب محفظ)
  const linkedRes = await pool.request()
    .input('userId', sql.Int, userId)
    .query('SELECT TOP 1 studentId FROM ParentStudents WHERE userId = @userId');

  if (linkedRes.recordset.length === 0) {
    return { isSelf: false, isSibling: false, isBlocked: false, myStudentId: null, reason: null };
  }

  const myStudentId = linkedRes.recordset[0].studentId;

  // 2. هل هو نفس الطالب؟
  if (myStudentId === targetId) {
    return {
      isSelf: true,
      isSibling: false,
      isBlocked: true,
      myStudentId,
      reason: 'self',
      message: 'لا يمكن التسميع لنفسك'
    };
  }

  // 3. فحص هل هو أخ أو أخت
  // جلب بيانات الطالبين
  const studentsRes = await pool.request()
    .input('myStudentId', sql.Int, myStudentId)
    .input('targetId', sql.Int, targetId)
    .query('SELECT id, parentPhone, parentPhone2 FROM Students WHERE id IN (@myStudentId, @targetId)');

  const myStudent = studentsRes.recordset.find(s => s.id === myStudentId);
  const targetStudent = studentsRes.recordset.find(s => s.id === targetId);

  if (myStudent && targetStudent) {
    const myPhones = [myStudent.parentPhone, myStudent.parentPhone2]
      .map(cleanPhone)
      .filter(p => p.length >= 8);

    const targetPhones = [targetStudent.parentPhone, targetStudent.parentPhone2]
      .map(cleanPhone)
      .filter(p => p.length >= 8);

    const hasCommonPhone = myPhones.some(p => targetPhones.includes(p));
    if (hasCommonPhone) {
      return {
        isSelf: false,
        isSibling: true,
        isBlocked: true,
        myStudentId,
        reason: 'sibling',
        message: 'لا يمكن التسميع لأخيك أو أختك'
      };
    }
  }

  // فحص اشتراك حساب ولي الأمر في جدول ParentStudents
  const sharedParentRes = await pool.request()
    .input('myStudentId', sql.Int, myStudentId)
    .input('targetId', sql.Int, targetId)
    .query(`
      SELECT TOP 1 1 FROM ParentStudents ps1
      JOIN ParentStudents ps2 ON ps1.userId = ps2.userId
      JOIN Users u ON u.id = ps1.userId
      WHERE ps1.studentId = @myStudentId 
        AND ps2.studentId = @targetId 
        AND u.role = 'parent'
    `);

  if (sharedParentRes.recordset.length > 0) {
    return {
      isSelf: false,
      isSibling: true,
      isBlocked: true,
      myStudentId,
      reason: 'sibling',
      message: 'لا يمكن التسميع لأخيك أو أختك'
    };
  }

  return { isSelf: false, isSibling: false, isBlocked: false, myStudentId, reason: null, message: null };
}

module.exports = { checkSelfOrSibling };
