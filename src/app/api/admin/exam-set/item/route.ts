import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

// 시험지에 항목 담기 (passage 세트 또는 단독 question)
// body: { examSetId, kind: "passage"|"question", passageId?, questionId?, sectionLabel? }
export async function POST(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) return FORBIDDEN;
    const ownerId = Number(session.userId);

    try {
        const body = await request.json();
        const { examSetId, kind, passageId, questionId, sectionLabel } = body;

        if (!examSetId) return NextResponse.json({ error: 'examSetId가 필요합니다.' }, { status: 400 });
        if (kind !== 'passage' && kind !== 'question') {
            return NextResponse.json({ error: 'kind는 passage 또는 question이어야 합니다.' }, { status: 400 });
        }
        if (kind === 'passage' && !passageId) {
            return NextResponse.json({ error: 'passageId가 필요합니다.' }, { status: 400 });
        }
        if (kind === 'question' && !questionId) {
            return NextResponse.json({ error: 'questionId가 필요합니다.' }, { status: 400 });
        }

        const exam = await prisma.examSet.findUnique({ where: { id: parseInt(String(examSetId), 10) } });
        if (!exam || exam.ownerId !== ownerId) {
            return NextResponse.json({ error: '시험지를 찾을 수 없습니다.' }, { status: 404 });
        }

        // 마지막 order 찾기
        const last = await prisma.examItem.findFirst({
            where: { examSetId: exam.id },
            orderBy: { order: 'desc' },
        });
        const nextOrder = (last?.order ?? -1) + 1;

        // 중복 방지: 동일 (kind, passageId, questionId) 이미 있으면 noop
        const existing = await prisma.examItem.findFirst({
            where: {
                examSetId: exam.id,
                kind,
                passageId: kind === 'passage' ? parseInt(String(passageId), 10) : null,
                questionId: kind === 'question' ? parseInt(String(questionId), 10) : null,
            },
        });
        if (existing) {
            return NextResponse.json({ alreadyExists: true, item: existing });
        }

        const item = await prisma.examItem.create({
            data: {
                examSetId: exam.id,
                kind,
                passageId: kind === 'passage' ? parseInt(String(passageId), 10) : null,
                questionId: kind === 'question' ? parseInt(String(questionId), 10) : null,
                sectionLabel: sectionLabel ?? null,
                order: nextOrder,
            },
        });
        return NextResponse.json(item);
    } catch (error: any) {
        console.error('Add ExamItem Error:', error);
        return NextResponse.json(
            { error: '항목 추가 실패', detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}

// 항목 삭제
export async function DELETE(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) return FORBIDDEN;
    const ownerId = Number(session.userId);

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

        const item = await prisma.examItem.findUnique({
            where: { id: parseInt(id, 10) },
            include: { examSet: true },
        });
        if (!item || item.examSet.ownerId !== ownerId) {
            return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
        }
        await prisma.examItem.delete({ where: { id: item.id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete ExamItem Error:', error);
        return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }
}

// 항목 순서 일괄 변경 / sectionLabel 변경
// body: { examSetId, items: [{ id, order, sectionLabel? }] }
export async function PUT(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) return FORBIDDEN;
    const ownerId = Number(session.userId);

    try {
        const body = await request.json();
        const { examSetId, items } = body;
        if (!examSetId || !Array.isArray(items)) {
            return NextResponse.json({ error: 'examSetId와 items가 필요합니다.' }, { status: 400 });
        }

        const exam = await prisma.examSet.findUnique({ where: { id: parseInt(String(examSetId), 10) } });
        if (!exam || exam.ownerId !== ownerId) {
            return NextResponse.json({ error: '시험지를 찾을 수 없습니다.' }, { status: 404 });
        }

        const clamp = (v: any, min: number, max: number, fallback: number) => {
            const n = typeof v === 'number' ? v : parseFloat(String(v));
            if (!isFinite(n)) return fallback;
            return Math.max(min, Math.min(max, n));
        };

        await prisma.$transaction(
            items.map((it: any) => {
                const data: any = {
                    order: parseInt(String(it.order), 10),
                };
                if (it.sectionLabel !== undefined) data.sectionLabel = it.sectionLabel || null;
                if (it.imageScale !== undefined) data.imageScale = clamp(it.imageScale, 0.3, 2.0, 1.0);
                if (it.imageAlign !== undefined && ['left', 'center', 'right'].includes(it.imageAlign)) {
                    data.imageAlign = it.imageAlign;
                }
                if (it.cropTop !== undefined) data.cropTop = clamp(it.cropTop, 0, 0.45, 0);
                if (it.cropBottom !== undefined) data.cropBottom = clamp(it.cropBottom, 0, 0.45, 0);
                if (it.cropLeft !== undefined) data.cropLeft = clamp(it.cropLeft, 0, 0.45, 0);
                if (it.cropRight !== undefined) data.cropRight = clamp(it.cropRight, 0, 0.45, 0);
                return prisma.examItem.update({
                    where: { id: parseInt(String(it.id), 10) },
                    data,
                });
            })
        );

        const updated = await prisma.examItem.findMany({
            where: { examSetId: exam.id },
            orderBy: { order: 'asc' },
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Reorder ExamItem Error:', error);
        return NextResponse.json(
            { error: '순서 변경 실패', detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}
