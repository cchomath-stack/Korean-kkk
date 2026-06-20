// 태그 데이터 진단
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tagCount = await prisma.tag.count();
    const passageTagCount = await prisma.passageTag.count();
    const questionTagCount = await prisma.questionTag.count();
    const passageCount = await prisma.passage.count();
    const questionCount = await prisma.question.count();

    console.log('=== 태그 데이터 현황 ===');
    console.log(`Tag 마스터: ${tagCount}개`);
    console.log(`Passage: ${passageCount}개`);
    console.log(`Question: ${questionCount}개`);
    console.log(`PassageTag 연결: ${passageTagCount}개`);
    console.log(`QuestionTag 연결: ${questionTagCount}개`);
    console.log('');

    // 태그가 1개도 없는 passage/question 비율
    const passagesWithoutTags = await prisma.passage.count({
        where: { tags: { none: {} } },
    });
    const questionsWithoutTags = await prisma.question.count({
        where: { tags: { none: {} } },
    });
    console.log(`태그 없는 Passage: ${passagesWithoutTags}/${passageCount} (${Math.round(passagesWithoutTags / passageCount * 100)}%)`);
    console.log(`태그 없는 Question: ${questionsWithoutTags}/${questionCount} (${Math.round(questionsWithoutTags / questionCount * 100)}%)`);
    console.log('');

    // 최근 변경된 passage/question 5개씩
    console.log('=== 최근 업데이트된 Passage 5개 ===');
    const recentP = await prisma.passage.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { _count: { select: { tags: true } } },
    });
    for (const p of recentP) {
        console.log(`  #${p.id} ${p.area || '-'} ${p.year}.${p.month} | 태그 ${p._count.tags}개 | 업데이트 ${p.updatedAt.toISOString().slice(0, 16)}`);
    }
    console.log('');
    console.log('=== 최근 업데이트된 Question 5개 ===');
    const recentQ = await prisma.question.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { _count: { select: { tags: true } } },
    });
    for (const q of recentQ) {
        console.log(`  #${q.id} 번호${q.questionNo || '?'} | 태그 ${q._count.tags}개 | 업데이트 ${q.updatedAt.toISOString().slice(0, 16)}`);
    }

    // legacy keywords 필드 사용 현황
    console.log('');
    console.log('=== Legacy keywords 필드 (Question) ===');
    const withKeywords = await prisma.question.count({
        where: { keywords: { not: null } },
    });
    console.log(`keywords 필드에 값 있는 Question: ${withKeywords}/${questionCount}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
