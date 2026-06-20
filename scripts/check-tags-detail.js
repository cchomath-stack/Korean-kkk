// 시기별 태그 보유 현황 + 어제(6/3) 작업 대상 확인
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Passage: 연월별로 태그 보유율
    const passages = await prisma.passage.findMany({
        select: { id: true, year: true, month: true, grade: true, area: true, updatedAt: true,
                  _count: { select: { tags: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    const byYM = new Map();
    for (const p of passages) {
        const k = `${p.year ?? '?'}.${p.month ?? '?'}`;
        const cur = byYM.get(k) || { total: 0, withTags: 0, ids: [] };
        cur.total++;
        if (p._count.tags > 0) cur.withTags++;
        cur.ids.push({ id: p.id, tags: p._count.tags, updated: p.updatedAt.toISOString().slice(0, 16) });
        byYM.set(k, cur);
    }
    console.log('=== Passage 시기별 태그 보유 ===');
    for (const [k, v] of byYM.entries()) {
        const tagless = v.ids.filter((x) => x.tags === 0);
        console.log(`  ${k.padEnd(10)} | ${v.withTags}/${v.total} | 태그없는 ID: ${tagless.map((x) => `#${x.id}(${x.updated})`).join(', ') || '-'}`);
    }

    // Question: 연월별 (passage 기준) 태그 보유율
    console.log('\n=== Question 시기별 태그 보유 ===');
    const questions = await prisma.question.findMany({
        select: { id: true, questionNo: true, updatedAt: true, keywords: true,
                  passage: { select: { year: true, month: true } },
                  _count: { select: { tags: true } } },
    });
    const qByYM = new Map();
    for (const q of questions) {
        const k = q.passage ? `${q.passage.year ?? '?'}.${q.passage.month ?? '?'}` : '단독';
        const cur = qByYM.get(k) || { total: 0, withTags: 0, withLegacyKw: 0, tagless: [] };
        cur.total++;
        if (q._count.tags > 0) cur.withTags++;
        if (q.keywords) cur.withLegacyKw++;
        if (q._count.tags === 0 && !q.keywords) cur.tagless.push(`#${q.id}(${q.updatedAt.toISOString().slice(5, 16)})`);
        qByYM.set(k, cur);
    }
    for (const [k, v] of qByYM.entries()) {
        console.log(`  ${k.padEnd(10)} | tags ${v.withTags}/${v.total} · legacy keywords ${v.withLegacyKw}/${v.total} · 둘다없음: ${v.tagless.length}`);
    }

    // 어제(6/3) 업데이트된 문제 중 태그 없는 것들
    console.log('\n=== 6/3 업데이트된 Question 중 태그 0개 ===');
    const yesterday = new Date('2026-06-03T00:00:00Z');
    const today = new Date('2026-06-04T00:00:00Z');
    const yQ = await prisma.question.findMany({
        where: {
            updatedAt: { gte: yesterday, lt: today },
            tags: { none: {} },
        },
        select: { id: true, questionNo: true, keywords: true, updatedAt: true,
                  passage: { select: { year: true, month: true } } },
        take: 20,
    });
    for (const q of yQ) {
        console.log(`  #${q.id} ${q.passage?.year}.${q.passage?.month} ${q.questionNo}번 | legacy keywords: ${q.keywords || '(없음)'}`);
    }
    console.log(`  ... 총 ${yQ.length}개 표시 (최대 20)`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
