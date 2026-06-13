import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_COUNT = 100;
const DEFAULT_PASSWORD = 'Password123';
const DEFAULT_DOMAIN = 'example.com';
const DEFAULT_PREFIX = 'testuser';
const BATCH_SIZE = 500;

function parseArgs(argv) {
  let count = DEFAULT_COUNT;
  let password = DEFAULT_PASSWORD;
  let domain = DEFAULT_DOMAIN;
  let prefix = DEFAULT_PREFIX;
  let start = 1;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--count' || arg === '-n') {
      count = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--password') {
      password = argv[i + 1];
      i += 1;
    } else if (arg === '--domain') {
      domain = argv[i + 1];
      i += 1;
    } else if (arg === '--prefix') {
      prefix = argv[i + 1];
      i += 1;
    } else if (arg === '--start') {
      start = Number(argv[i + 1]);
      i += 1;
    } else if (/^\d+$/.test(arg)) {
      count = Number(arg);
    }
  }

  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Count must be a positive integer.');
  }
  if (!Number.isInteger(start) || start < 1) {
    throw new Error('Start index must be a positive integer.');
  }

  return { count, password, domain, prefix, start };
}

async function main() {
  const { count, password, domain, prefix, start } = parseArgs(process.argv.slice(2));
  const verifiedAt = new Date();
  const passwordHash = await bcrypt.hash(password, 10);

  let created = 0;
  let skipped = 0;

  for (let offset = 0; offset < count; offset += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, count - offset);
    const rows = Array.from({ length: batchCount }, (_, index) => {
      const n = start + offset + index;
      return {
        email: `${prefix}${n}@${domain}`,
        passwordHash,
        name: `Test User ${n}`,
        role: 'user',
        emailVerifiedAt: verifiedAt,
        passwordChangedAt: verifiedAt,
      };
    });

    const result = await prisma.user.createMany({
      data: rows,
      skipDuplicates: true,
    });

    created += result.count;
    skipped += batchCount - result.count;
  }

  const firstEmail = `${prefix}${start}@${domain}`;
  const lastEmail = `${prefix}${start + count - 1}@${domain}`;

  console.log(`Test users seed complete.`);
  console.log(`  Requested: ${count}`);
  console.log(`  Created:   ${created}`);
  console.log(`  Skipped:   ${skipped} (already existed)`);
  console.log(`  Email range: ${firstEmail} … ${lastEmail}`);
  console.log(`  Password: ${password}`);
  console.log(`  All users are email-verified and ready to log in.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
