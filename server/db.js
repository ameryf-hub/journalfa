import 'dotenv/config';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString,
  ssl: resolveSsl(connectionString)
});

// Prevent an unexpected reset on an idle client from crashing the process.
pool.on('error', (error) => {
  console.error('Unexpected Postgres pool error:', error.message);
});

await initSchema();

function resolveSsl(url) {
  // Allow an explicit override via env var.
  if (process.env.PGSSL === 'true') {
    return { rejectUnauthorized: false };
  }

  if (process.env.PGSSL === 'false') {
    return false;
  }

  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    host = '';
  }

  // Railway's private network and local Postgres do not use TLS.
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.internal')) {
    return false;
  }

  // Public/proxy endpoints (e.g. *.proxy.rlwy.net) require TLS.
  return { rejectUnauthorized: false };
}

async function initSchema(retries = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query(`
        create table if not exists journal_entries (
          id bigserial primary key,
          title text not null default '',
          content text not null,
          mood text not null default '',
          tags text[] not null default '{}',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      return;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      console.error(
        `Schema init failed (attempt ${attempt}/${retries}): ${error.message}. Retrying in ${delayMs}ms.`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function listEntries() {
  const { rows } = await pool.query(
    `
      select id, title, content, mood, tags, created_at, updated_at
      from journal_entries
      order by created_at desc, id desc
    `
  );

  return rows;
}

export async function createEntry(entry) {
  const { rows } = await pool.query(
    `
      insert into journal_entries (title, content, mood, tags)
      values ($1, $2, $3, $4)
      returning id, title, content, mood, tags, created_at, updated_at
    `,
    [entry.title, entry.content, entry.mood, entry.tags]
  );

  return rows[0];
}

export async function updateEntry(id, entry) {
  const { rows } = await pool.query(
    `
      update journal_entries
      set title = $2,
          content = $3,
          mood = $4,
          tags = $5,
          updated_at = now()
      where id = $1
      returning id, title, content, mood, tags, created_at, updated_at
    `,
    [id, entry.title, entry.content, entry.mood, entry.tags]
  );

  return rows[0] ?? null;
}

export async function deleteEntry(id) {
  const { rowCount } = await pool.query('delete from journal_entries where id = $1', [id]);
  return rowCount > 0;
}

export async function closePool() {
  await pool.end();
}