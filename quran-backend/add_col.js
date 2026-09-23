const { getPool } = require('./db');

async function updateSchema() {
  const pool = await getPool();
  const sql = `
    IF NOT EXISTS (
      SELECT * FROM sys.columns 
      WHERE object_id = OBJECT_ID('Students') AND name = 'parentPhone2'
    )
    BEGIN
      ALTER TABLE Students ADD parentPhone2 NVARCHAR(50) NULL;
      PRINT 'parentPhone2 added to Students';
    END
  `;
  await pool.request().query(sql);
  console.log('SCHEMA_UPDATE_SUCCESS');
}

updateSchema().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
