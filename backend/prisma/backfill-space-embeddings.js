import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  buildSpaceEmbeddingText,
  embedDocumentsBatch,
  toSqlVector,
  EMBEDDING_BATCH_SIZE,
} from '../src/lib/embeddings.js';

const prisma = new PrismaClient();

// By default only embeds active spaces with a NULL embedding.
// Pass --all to (re)embed every active space.
const ALL = process.argv.includes('--all');

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is required to backfill embeddings.');
    process.exit(1);
  }

  const rows = ALL
    ? await prisma.$queryRawUnsafe(`SELECT id FROM "Space" WHERE status = 'active'`)
    : await prisma.$queryRawUnsafe(
        `SELECT id FROM "Space" WHERE status = 'active' AND embedding IS NULL`
      );
  const ids = rows.map((r) => r.id);
  console.log(`Embedding ${ids.length} space(s)${ALL ? ' (--all)' : ' (missing only)'}...`);

  let done = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i += EMBEDDING_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + EMBEDDING_BATCH_SIZE);
    const spaces = await prisma.space.findMany({
      where: { id: { in: batchIds } },
      select: {
        id: true,
        title: true,
        category: true,
        location: true,
        description: true,
        amenities: { select: { amenityId: true } },
      },
    });

    // Preserve batch order for stable logging.
    const byId = new Map(spaces.map((s) => [s.id, s]));
    const ordered = batchIds.map((id) => byId.get(id)).filter(Boolean);
    const texts = ordered.map(buildSpaceEmbeddingText);
    const vectors = await embedDocumentsBatch(texts);

    for (let j = 0; j < ordered.length; j += 1) {
      const vec = vectors[j];
      if (!vec) {
        failed += 1;
        continue;
      }
      await prisma.$executeRawUnsafe(
        `UPDATE "Space" SET embedding = $1::vector WHERE id = $2`,
        toSqlVector(vec),
        ordered[j].id
      );
      done += 1;
    }

    console.log(
      `  ${Math.min(i + EMBEDDING_BATCH_SIZE, ids.length)}/${ids.length} processed (ok=${done}, failed=${failed})`
    );
  }

  console.log(`Done. Embedded ${done} space(s), ${failed} failed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
