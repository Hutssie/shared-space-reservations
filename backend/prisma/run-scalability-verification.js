import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const steps = [
  ['verify-space-amenities.js', 'Amenity relations'],
  ['verify-space-availability-rules.js', 'Availability rules'],
  ['verify-search-totals.js', 'Search totals vs API'],
  ['verify-booking-exclusion.js', 'Booking exclusion constraint'],
];

for (const [script, label] of steps) {
  console.log(`\n>>> ${label}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });
  if (result.status !== 0) {
    console.error(`\nScalability verification failed at: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nAll scalability verification steps passed.');
