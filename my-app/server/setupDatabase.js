//Setup for db
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool } from './db.js';

const directory = new URL('../database/', import.meta.url);
const adoptExisting = process.argv.includes('--adopt-existing');

async function setupDatabase() {
  const filenames = (await readdir(directory))
    .filter(name => name.endsWith('.sql'))
    .sort();

  if (filenames.length === 0) {
    throw new Error('No packaged migrations found.');
  }

  const migrations = [];

  for (const name of filenames) {
    const sql = await readFile(new URL(name, directory), 'utf8');

    migrations.push({
      name,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
    });
  }

  const db = await pool.connect();

  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(734201)');

    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    if (adoptExisting) {
      const expectedFiles = [
        '00_initial.sql',
        '01_add_auth_accounts.sql',
        '02_link_messages_to_memberships.sql',
      ];

      if (JSON.stringify(filenames) !== JSON.stringify(expectedFiles)) {
        throw new Error('Adoption requires exactly the original three SQL files.');
      }

      const check = await db.query(`
        SELECT
          to_regclass('public.auth_accounts') IS NOT NULL
            AS has_auth_accounts,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'memberships'
              AND column_name = 'membership_active'
          ) AS has_membership_active,
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'messages'
              AND column_name = 'membership_id'
          ) AS has_message_membership,
          NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND (
                (table_name = 'users' AND column_name = 'github_id')
                OR
                (table_name = 'messages'
                  AND column_name IN ('user_id', 'room_id'))
              )
          ) AS old_columns_removed
      `);

      if (!Object.values(check.rows[0]).every(Boolean)) {
        throw new Error('Existing database does not match the expected migrations.');
      }

      for (const migration of migrations) {
        await db.query(
          `INSERT INTO schema_migrations (name, checksum)
           VALUES ($1, $2)
           ON CONFLICT (name) DO NOTHING`,
          [migration.name, migration.checksum]
        );
      }
    }

    const applied = await db.query(
      'SELECT name, checksum FROM schema_migrations'
    );

    const recorded = new Map(
      applied.rows.map(row => [row.name, row.checksum])
    );

    for (const migration of migrations) {
      if (recorded.has(migration.name)) {
        if (recorded.get(migration.name) !== migration.checksum) {
          throw new Error(`Previously applied migration changed: ${migration.name}`);
        }

        console.log(`Already applied: ${migration.name}`);
        continue;
      }

      await db.query(migration.sql.replace(/^\uFEFF/, ''));

      await db.query(
        'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
        [migration.name, migration.checksum]
      );

      console.log(`Applied: ${migration.name}`);
    }

    await db.query('LOCK TABLE rooms IN SHARE ROW EXCLUSIVE MODE');

    await db.query(`
      INSERT INTO rooms (name, type)
      SELECT seed.name, 'general'
      FROM (
        VALUES ('General'), ('Tech'), ('Off-topic')
      ) AS seed(name)
      WHERE NOT EXISTS (
        SELECT 1 FROM rooms
        WHERE rooms.type = 'general'
          AND rooms.name = seed.name
      )
    `);

    await db.query(`
      INSERT INTO memberships (user_id, room_id)
      SELECT users.user_id, rooms.room_id
      FROM users
      CROSS JOIN rooms
      WHERE rooms.type = 'general'
      ON CONFLICT (user_id, room_id) DO NOTHING
    `);

    await db.query('COMMIT');
    console.log('Database ready. General rooms and memberships seeded.');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

try {
  await setupDatabase();
} catch (error) {
  console.error('Database setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}