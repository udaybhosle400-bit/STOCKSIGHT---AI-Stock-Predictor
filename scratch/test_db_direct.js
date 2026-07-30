const { initDatabase, query } = require('../config/database');

async function testDirect() {
  console.log('Initializing database...');
  await initDatabase();
  console.log('Testing query...');
  try {
    const res = await query('SELECT count(*) FROM users');
    console.log('Users count:', res.rows);
  } catch (e) {
    console.error('Direct query error:', e);
  }
}

testDirect();
