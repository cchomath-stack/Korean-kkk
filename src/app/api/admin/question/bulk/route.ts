import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
const MAX_BULK = 500;

// 일괄 문법 카테고리 추가 (merge: 기존 카테고리 유지, 신규 추가)
export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const questionIds = Array.isArray(body.questionIds)
            ? body.questionIds.map((v: any) => parseInt(String(v), 10)).filter((n: number) => !Number.isNaN(n))
            : [];
        const categoryIds = Array.isArray(body.categoryIds)
            ? body.categoryIds.map((v: any) => parseInt(String(v), 10)).filter((n: number) => !Number.isNaN(n))
            : [];

        if (questionIds.length === 0 || categoryIds.length === 0) {
            return NextResponse.json({ error: 'questionIds와 categoryIds 모두 1개 이상 필요합니다.' }, { status: 400 });
        }
        if (questionIds.length > MAX_BULK) {
            return NextResponse.json({ error: `한 번에 최대 ${MAX_BULK}개까지 처리 가능합니다.` }, { status: 400 });
        }

        // 이미 존재하는 (questionId, categoryId) 조합 조회 → 중복 방지
        const existing = await prisma.questionGrammarCategory.findMany({
            where: {
                questionId: { in: questionIds },
                categoryId: { in: categoryIds },
            },
            select: { questionId: true, categoryId: true },
        });
        const existingSet = new Set(existing.map((e) => `${e.questionId}-${e.categoryId}`));

        // 만들 쌍들 구성 (이미 있는 건 skip)
        const toCreate: { questionId: number; categoryId: number }[] = [];
        for (const qid of questionIds) {
            for (const cid of categoryIds) {
                const key = `${qid}-${cid}`;
                if (!existingSet.has(key)) {
                    toCreate.push({ questionId: qid, categoryId: cid });
                }
            }
        }

        let created = 0;
        if (toCreate.length > 0) {
            const result = await prisma.questionGrammarCategory.createMany({ data: toCreate });
            created = result.count;
        }

        return NextResponse.json({
            success: true,
            questionsAffected: questionIds.length,
            categoriesAssigned: categoryIds.length,
            newConnections: created,
            alreadyExisted: toCreate.length === 0 ? questionIds.length * categoryIds.length : (questionIds.length * categoryIds.length - toCreate.length),
        });
    } catch (error) {
        console.error('Bulk grammar add error:', error);
        return NextResponse.json({ error: '일괄 처리 실패' }, { status: 500 });
    }
}

// 일괄 삭제
export async function DELETE(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const ids = Array.isArray(body.questionIds)
            ? body.questionIds.map((v: any) => parseInt(String(v), 10)).filter((n: number) => !Number.isNaN(n))
            : [];

        if (ids.length === 0) {
            return NextResponse.json({ error: '삭제할 문제 ID가 없습니다.' }, { status: 400 });
        }
        if (ids.length > MAX_BULK) {
            return NextResponse.json({ error: `한 번에 최대 ${MAX_BULK}개까지 삭제 가능합니다.` }, { status: 400 });
        }

        const result = await prisma.question.deleteMany({ where: { id: { in: ids } } });
        return NextResponse.json({ success: true, deleted: result.count });
    } catch (error) {
        console.error('Bulk delete error:', error);
        return NextResponse.json({ error: '일괄 삭제 실패' }, { status: 500 });
    }
}
