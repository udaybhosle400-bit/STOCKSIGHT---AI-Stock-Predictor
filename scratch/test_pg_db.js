const { PGlite } = require('@electric-sql/pglite');

async function testWrapper() {
  const db = new PGlite('./storage/pgdata');

  // Test multi-statement DDL with exec
  await db.exec(`
    CREATE TABLE IF NOT EXISTS test_items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      details JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_test_items_title ON test_items(title);
  `);

  // Test query with params and JSONB
  const insertRes = await db.query(
    'INSERT INTO test_items (title, details) VALUES ($1, $2) RETURNING *',
    ['item1', JSON.stringify({ score: 98.5 })]
  );
  console.log('Insert RETURNING rows:', insertRes.rows);

  const selectRes = await db.query('SELECT * FROM test_items WHERE title = $1', ['item1']);
  console.log('Select rows:', selectRes.rows);
}

testWrapper().catch(e => console.error(e));
