/**
 * Legacy data migration:
 *   - Passage.imageUrl  -> PassageImage (order=0)
 *   - Question.keywords -> Tag + QuestionTag
 *
 * Idempotent: safe to run multiple times.
 * Run: node scripts/migrate-legacy-data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migratePassageImages() {
  const passages = await prisma.passage.findMany({
    where: { imageUrl: { not: null } },
    include: { images: true },
  });

  let created = 0;
  let skipped = 0;
  for (const p of passages) {
    const alreadyMigrated = p.images.some((img) => img.imageUrl === p.imageUrl);
    if (alreadyMigrated) {
      skipped++;
      continue;
    }
    await prisma.passageImage.create({
      data: {
        passageId: p.id,
        imageUrl: p.imageUrl,
        ocrText: p.ocrText,
        order: 0,
      },
    });
    created++;
  }
  console.log(`[PassageImage] created=${created} skipped=${skipped} total=${passages.length}`);
}

async function migrateTags() {
  const questions = await prisma.question.findMany({
    where: { keywords: { not: null } },
    include: { tags: true },
  });

  const tagCache = new Map();
  let createdLinks = 0;
  let createdTags = 0;
  let skipped = 0;

  for (const q of questions) {
    const raw = (q.keywords || '').trim();
    if (!raw) {
      skipped++;
      continue;
    }
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const name of names) {
      let tagId = tagCache.get(name);
      if (!tagId) {
        const tag = await prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        if (tag.createdAt && Date.now() - tag.createdAt.getTime() < 5000) createdTags++;
        tagId = tag.id;
        tagCache.set(name, tagId);
      }

      const exists = q.tags.some((t) => t.tagId === tagId);
      if (exists) continue;

      await prisma.questionTag.create({
        data: { questionId: q.id, tagId },
      });
      createdLinks++;
    }
  }
  console.log(
    `[Tag/QuestionTag] tagsCreated~=${createdTags} linksCreated=${createdLinks} questionsSkippedEmpty=${skipped}`
  );
}

async function main() {
  console.log('--- Legacy Data Migration Start ---');
  await migratePassageImages();
  await migrateTags();
  console.log('--- Done ---');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
