const { getPool } = require('./db');

async function addParentName2() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM sys.columns 
      WHERE object_id = OBJECT_ID('Students') AND name = 'parentName2'
    )
    BEGIN
      ALTER TABLE Students ADD parentName2 NVARCHAR(100) NULL;
      PRINT 'parentName2 column added successfully';
    END
    ELSE
    BEGIN
      PRINT 'parentName2 already exists';
    END
  `);
  console.log('MIGRATION_PARENTNAME2_OK');
}

addParentName2().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
