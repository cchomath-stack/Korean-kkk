/**
 * 초기 문법(어법) 카테고리 시드
 * Run: node scripts/seed-grammar-categories.js
 * Idempotent: 이미 존재하면 skip
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TAXONOMY = [
    { name: '단어편', children: ['품사', '형태소와 단어', '단어의 짜임새'] },
    { name: '문장편', children: ['문장 성분', '문장의 짜임새', '문법요소', '담화 표현'] },
    { name: '음운편', children: ['음운의 정의와 체계', '음운변동'] },
    { name: '기타', children: ['한글맞춤법', '로마자표기법/외래어표기법', '중의성 외'] },
];

async function main() {
    let createdRoots = 0;
    let createdChildren = 0;
    for (let i = 0; i < TAXONOMY.length; i++) {
        const { name, children } = TAXONOMY[i];
        let parent = await prisma.grammarCategory.findFirst({
            where: { name, parentId: null },
        });
        if (!parent) {
            parent = await prisma.grammarCategory.create({
                data: { name, order: i, parentId: null },
            });
            createdRoots++;
            console.log(`✓ ROOT: ${name}`);
        }
        for (let j = 0; j < children.length; j++) {
            const childName = children[j];
            const existing = await prisma.grammarCategory.findFirst({
                where: { name: childName, parentId: parent.id },
            });
            if (!existing) {
                await prisma.grammarCategory.create({
                    data: { name: childName, order: j, parentId: parent.id },
                });
                createdChildren++;
                console.log(`  ↳ ${childName}`);
            }
        }
    }
    console.log(`\nDone. Created ${createdRoots} root + ${createdChildren} child categories.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
