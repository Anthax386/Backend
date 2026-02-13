const { Pool } = require('pg');

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialiser les tables
const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Table users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table events
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        date VARCHAR(50) NOT NULL,
        time VARCHAR(50),
        format VARCHAR(100),
        max_players INTEGER,
        discord_link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table refresh_tokens
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('✅ Tables PostgreSQL créées avec succès');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la création des tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDatabase };
