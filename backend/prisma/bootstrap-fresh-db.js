/**
 * Fresh-database bootstrap when migrate deploy cannot run from zero
 * (migrations are incremental deltas on a db-push baseline).
 *
 * Usage: npm run db:bootstrap
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIGRATIONS = [
  '20250604120000_add_booking_minutes',
  '20250604120001_booking_exclusion_constraint',
  '20250605120000_normalize_amenities',
  '20250605130000_space_search_indexes',
  '20250606120000_normalize_availability_rules',
  '20250606130000_drop_legacy_json_columns',
  '20250607120000_add_location_norm',
  '20250608120000_favorite_created_at',
  '20250608120000_stripe_payments',
  '20250608130000_materialize_favorite_created_at',
  '20250608140000_password_changed_at',
  '20250609120000_stripe_connect',
  '20250609130000_remove_stripe_connect',
  '20250609140000_email_verification',
  '20250609160000_add_space_embedding',
];

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: backendRoot, shell: true });
}

async function hasUserTables() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'"
  );
  await client.end();
  return rows.length > 0;
}

async function clearMigrationHistory() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(`SELECT to_regclass('"_prisma_migrations"') AS reg`);
  if (!rows[0]?.reg) {
    await client.end();
    return false;
  }
  await client.query('DELETE FROM "_prisma_migrations"');
  await client.end();
  return true;
}

async function ensurePgVector() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (e) {
    console.error(
      'Failed to enable pgvector. Install it in PostgreSQL (https://github.com/pgvector/pgvector) and retry.'
    );
    throw e;
  }
  await client.end();
}

async function resetPublicSchema() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO public');
  await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
  await client.end();
}

async function main() {
  const force = process.argv.includes('--force');
  const userTables = await hasUserTables();
  if (userTables && !force) {
    console.error(
      'Refusing to bootstrap: public schema already has tables.\n' +
        '  • Upgraded DB: use npm run db:deploy\n' +
        '  • Broken/partial fresh DB: npm run db:bootstrap -- --force'
    );
    process.exit(1);
  }

  if (userTables && force) {
    console.log('Force: dropping public schema and recreating…');
    await resetPublicSchema();
  } else {
    console.log('Clearing failed migration records…');
    const cleared = await clearMigrationHistory();
    if (!cleared) console.log('  (no _prisma_migrations table — skipped)');
  }

  console.log('Enabling pgvector extension…');
  await ensurePgVector();

  console.log('\nApplying current schema via db push…');
  run('npx prisma db push --accept-data-loss');

  console.log('\nMarking incremental migrations as applied (baseline)…');
  for (const name of MIGRATIONS) {
    run(`npx prisma migrate resolve --applied ${name}`);
  }

  console.log('\nBootstrap complete. Run: npm run db:seed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
