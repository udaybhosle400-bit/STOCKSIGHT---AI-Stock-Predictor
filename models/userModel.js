const db = require('../config/database');

class UserModel {
  async create({ email, passwordHash, name }) {
    const res = await db.query(
      `INSERT INTO users (email, password_hash, name) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, name, created_at`,
      [email.toLowerCase(), passwordHash, name || '']
    );
    return res.rows[0];
  }

  async findByEmail(email) {
    const cleanEmail = (email || '').toLowerCase();
    const res = await db.query(`SELECT * FROM users WHERE email = $1`, [cleanEmail]);
    return res.rows[0] || null;
  }

  async findById(id) {
    const res = await db.query(`SELECT id, email, name, refresh_token, created_at FROM users WHERE id = $1`, [id]);
    return res.rows[0] || null;
  }

  async updateRefreshToken(id, refreshToken) {
    await db.query(`UPDATE users SET refresh_token = $1 WHERE id = $2`, [refreshToken, id]);
  }
}

module.exports = new UserModel();
