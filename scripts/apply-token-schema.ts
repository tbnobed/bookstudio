import { pool, db } from '../server/db';
import { inviteTokens, passwordResetTokens } from '../shared/schema';

async function applyTokenSchema() {
  try {
    console.log('Creating invite tokens table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS invite_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        email TEXT NOT NULL,
        expires TIMESTAMP NOT NULL,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        used BOOLEAN DEFAULT FALSE
      );
    `);

    console.log('Creating password reset tokens table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        expires TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        used BOOLEAN DEFAULT FALSE
      );
    `);

    console.log('Schema migration completed successfully.');
  } catch (error) {
    console.error('Error applying token schema:', error);
  } finally {
    await pool.end();
  }
}

applyTokenSchema();