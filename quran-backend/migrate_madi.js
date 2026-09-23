const { getPool } = require('./db');

async function migrateRolesAndSessions() {
  const pool = await getPool();

  // 1. إضافة أعمدة الأخطاء والتشكيلات والمُسمّع في Sessions
  const cols = [
    { name: 'madiMistakes', type: 'INT NULL' },
    { name: 'madiFormations', type: 'INT NULL' },
    { name: 'madiHeardBy', type: 'INT NULL' },
    { name: 'madiHeardByName', type: 'NVARCHAR(100) NULL' }
  ];

  for (const c of cols) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('Sessions') AND name = '${c.name}'
      )
      BEGIN
        ALTER TABLE Sessions ADD ${c.name} ${c.type};
        PRINT '${c.name} added to Sessions';
      END
    `);
  }

  // 2. تحديث قيد الأدوار في Users ليدعم student_teacher إن لم يكن مدعوماً
  try {
    // فحص القيود
    await pool.request().query(`
      DECLARE @ConstraintName nvarchar(200)
      SELECT @ConstraintName = Name FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID('Users') AND definition LIKE '%role%'

      IF @ConstraintName IS NOT NULL
      BEGIN
        EXEC('ALTER TABLE Users DROP CONSTRAINT ' + @ConstraintName)
      END

      ALTER TABLE Users ADD CONSTRAINT CK_Users_Role 
      CHECK (role IN ('admin', 'superadmin', 'student_teacher', 'parent', 'student'))
    `);
    console.log('Role constraints updated successfully');
  } catch (err) {
    console.log('Constraint update note:', err.message);
  }

  console.log('MIGRATION_COMPLETED');
}

migrateRolesAndSessions().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
