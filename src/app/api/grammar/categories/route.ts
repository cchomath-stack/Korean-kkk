import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';

// 인증된 모든 사용자가 카테고리 트리 조회 가능 (입력 화면 + 검색 화면에서 공용)
export async function GET() {
    if (!(await requireUser())) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    try {
        const all = await prisma.grammarCategory.findMany({
            orderBy: [{ parentId: 'asc' }, { order: 'asc' }, { id: 'asc' }],
            include: {
                _count: { select: { questions: true } },
            },
        });
        // 트리 구조로 가공
        const roots = all.filter((c) => c.parentId === null);
        const byParent = new Map<number, typeof all>();
        for (const c of all) {
            if (c.parentId == null) continue;
            const list = byParent.get(c.parentId) || [];
            list.push(c);
            byParent.set(c.parentId, list);
        }
        const tree = roots.map((r) => ({
            id: r.id,
            name: r.name,
            order: r.order,
            count: r._count.questions,
            children: (byParent.get(r.id) || []).map((c) => ({
                id: c.id,
                name: c.name,
                order: c.order,
                count: c._count.questions,
            })),
        }));
        return NextResponse.json({ tree });
    } catch (error) {
        console.error('Grammar categories GET error:', error);
        return NextResponse.json({ error: '카테고리 조회 실패' }, { status: 500 });
    }
}
