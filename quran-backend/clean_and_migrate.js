const { getPool } = require('./db');

async function cleanAndMigrate() {
  const pool = await getPool();

  console.log('--- بدء تحديث هيكل قاعدة البيانات وتنظيف البيانات ---');

  // 1. إضافة عمود sihhaText إن لم يكن موجوداً
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM sys.columns 
      WHERE object_id = OBJECT_ID('Sessions') AND name = 'sihhaText'
    )
    BEGIN
      ALTER TABLE Sessions ADD sihhaText NVARCHAR(MAX) NULL;
      PRINT 'sihhaText added to Sessions';
    END

    IF NOT EXISTS (
      SELECT * FROM sys.columns 
      WHERE object_id = OBJECT_ID('Sessions') AND name = 'lawhText'
    )
    BEGIN
      ALTER TABLE Sessions ADD lawhText NVARCHAR(MAX) NULL;
      PRINT 'lawhText added to Sessions';
    END
  `);

  // 2. فحص وإسقاط أي قيود CHECK متعلقة بالأعمدة القديمة
  const oldCols = ['lawhSurah', 'lawhFrom', 'lawhTo', 'sihhaSurah', 'sihhaFrom', 'sihhaTo'];
  for (const col of oldCols) {
    await pool.request().query(`
      IF EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Sessions') AND name = '${col}'
      )
      BEGIN
        ALTER TABLE Sessions DROP COLUMN ${col};
        PRINT '${col} dropped from Sessions';
      END
    `);
  }

  // 3. حذف البيانات بالترتيب احتراماً للـ Foreign Keys مع الإبقاء فقط على حساب الأدمن الرئيسي
  console.log('--- جاري حذف البيانات السابقة وتصفير الجداول ---');
  await pool.request().query(`
    DELETE FROM ParentStudents;
    DELETE FROM Payments;
    DELETE FROM Sessions;
    DELETE FROM Students;
    
    -- حذف جميع المستخدمين ما عدا الأدمن
    DELETE FROM Users WHERE role <> 'admin' AND isMainAdmin = 0;

    -- تصفير الترقيم التلقائي للجداول
    IF EXISTS (SELECT * FROM sys.identity_columns WHERE object_id = OBJECT_ID('Students'))
      DBCC CHECKIDENT ('Students', RESEED, 0);

    IF EXISTS (SELECT * FROM sys.identity_columns WHERE object_id = OBJECT_ID('Sessions'))
      DBCC CHECKIDENT ('Sessions', RESEED, 0);

    IF EXISTS (SELECT * FROM sys.identity_columns WHERE object_id = OBJECT_ID('Payments'))
      DBCC CHECKIDENT ('Payments', RESEED, 0);

    IF EXISTS (SELECT * FROM sys.identity_columns WHERE object_id = OBJECT_ID('ParentStudents'))
      DBCC CHECKIDENT ('ParentStudents', RESEED, 0);
  `);

  console.log('✅ تم تنظيف البيانات وتصفير الترقيم بنجاح.');

  // التحقق من حساب الأدمن
  const adminRes = await pool.request().query('SELECT id, username, name, role, isMainAdmin FROM Users');
  console.log('الحسابات المتبقية في النظام:', adminRes.recordset);

  // التحقق من أعمدة Sessions
  const colsRes = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Sessions'");
  console.log('أعمدة جدول Sessions الحالية:', colsRes.recordset.map(c => c.COLUMN_NAME));
}

cleanAndMigrate()
  .then(() => {
    console.log('تمت العملية بنجاح ✓');
    process.exit(0);
  })
  .catch(err => {
    console.error('حدث خطأ:', err);
    process.exit(1);
  });
