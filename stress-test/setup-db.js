/**
 * Bootstrap complet al bazei de date Docker pentru stress test.
 * Folosește bootstrap-fresh-db.js (db push + baseline migrări) în loc de migrate deploy,
 * deoarece migrările sunt delta-uri incrementale pe un baseline db-push — nu pot fi
 * aplicate pe o bază goală cu migrate deploy.
 *
 * Executat o singură dată înainte de stress test.
 * ATENȚIE: --force șterge toate datele existente din DB.
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..', 'backend');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/space_reservations?schema=public';

const env = { ...process.env, DATABASE_URL, DIRECT_URL: DATABASE_URL };

console.log('▶  Bootstrap baza de date (schema + pgvector + baseline migrări)...');
execSync('node prisma/bootstrap-fresh-db.js --force', {
  cwd: backendDir,
  env,
  stdio: 'inherit',
});

console.log('\n▶  Seed date inițiale (utilizatori de bază + spații)...');
execSync('node prisma/seed.js', {
  cwd: backendDir,
  env,
  stdio: 'inherit',
});

console.log('\n▶  Seed 2000 utilizatori de test (email-verificați)...');
execSync('node prisma/seed-test-users.js --count 2000', {
  cwd: backendDir,
  env,
  stdio: 'inherit',
});

console.log('\n✅ Baza de date pregătită pentru stress test.');
