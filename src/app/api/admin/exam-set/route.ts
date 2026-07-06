import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

// URL-safe 랜덤 슬러그 (10자, 소문자+숫자)
async function generateUniqueSlug(): Promise<string> {
    const CHARS = 'abcdefghijkmnpqrstuvwxyz23456789'; // 헷갈리는 0/o/1/l 제거
    for (let attempt = 0; attempt < 8; attempt++) {
        const bytes = new Uint8Array(10);
        crypto.getRandomValues(bytes);
        let slug = '';
        for (const b of bytes) slug += CHARS[b % CHARS.length];
        const existing = await prisma.examSet.findUnique({ where: { studentAccessSlug: slug } });
        if (!existing) return slug;
    }
    throw new Error('slug 발급 실패');
}

// 현재 작업중인 draft 시험지 조회 (없으면 새로 생성)
// 또는 ?id= 로 특정 시험지 조회 / ?status=saved 로 저장된 목록 조회
export async function GET(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) return FORBIDDEN;
    const ownerId = Number(session.userId);

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const status = searchParams.get('status');

    try {
        if (idParam) {
            const id = parseInt(idParam, 10);
            const exam = await prisma.examSet.findUnique({
                where: { id },
                include: {
                    items: {
                        orderBy: { order: 'asc' },
                    },
                },
            });
            if (!exam || exam.ownerId !== ownerId) {
                return NextResponse.json({ error: '시험지를 찾을 수 없습니다.' }, { status: 404 });
            }
            return NextResponse.json(exam);
        }

        if (status === 'saved') {
            const list = await prisma.examSet.findMany({
                where: { ownerId, status: 'saved' },
                orderBy: { updatedAt: 'desc' },
                include: { _count: { select: { items: true } } },
            });
            return NextResponse.json(list);
        }

        // 기본: draft 1개 (없으면 생성)
        let draft = await prisma.examSet.findFirst({
            where: { ownerId, status: 'draft' },
            include: { items: { orderBy: { order: 'asc' } } },
        });
        if (!draft) {
            draft = await prisma.examSet.create({
                data: { ownerId, status: 'draft' },
                include: { items: { orderBy: { order: 'asc' } } },
            });
        }
        return NextResponse.json(draft);
    } catch (error) {
        console.error('Fetch ExamSet Error:', error);
        return NextResponse.json({ error: '시험지 조회에 실패했습니다.' }, { status: 500 });
    }
}

// 메타 수정 (제목/소제목/학원명 등) / 상태 변경 (draft → saved)
export async function PUT(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) return FORBIDDEN;
    const ownerId = Number(session.userId);

    try {
        const body = await request.json();
        const { id, ...rest } = body;
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

        const exam = await prisma.examSet.findUnique({ where: { id: parseInt(String(id), 10) } });
        if (!exam || exam.ownerId !== ownerId) {
            return NextResponse.json({ error: '시험지를 찾을 수 없습니다.' }, { status: 404 });
        }

        const allowed = ['title', 'subTitle', 'academyName', 'grade', 'durationMin', 'totalScore', 'status', 'pdfUrl', 'isStudentPublic', 'wrongNoteDesign'] as const;
        const intFields = new Set(['grade', 'durationMin', 'totalScore']);
        const boolFields = new Set(['isStudentPublic']);
        const data: any = {};
        for (const k of allowed) {
            if (k in rest) {
                const v = (rest as any)[k];
                if (intFields.has(k)) {
                    data[k] = v === '' || v == null ? null : parseInt(String(v), 10);
                } else if (boolFields.has(k)) {
                    data[k] = !!v;
                } else {
                    data[k] = v === '' ? null : v;
                }
            }
        }

        // isStudentPublic=true로 전환하는 순간 slug가 없으면 새로 발급
        if (data.isStudentPublic === true && !exam.studentAccessSlug) {
            data.studentAccessSlug = await generateUniqueSlug();
        }

        const updated = await prisma.examSet.update({
            where: { id: exam.id },
            data,
            include: { items: { orderBy: { order: 'asc' } } },
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Update ExamSet Error:', error);
        return NextResponse.json(
            { error: '시험지 수정 실패', detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}

// 시험지 삭제 (draft 비우기 또는 saved 삭제)
export async function DELETE(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) return FORBIDDEN;
    const ownerId = Number(session.userId);

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

        const exam = await prisma.examSet.findUnique({ where: { id: parseInt(id, 10) } });
        if (!exam || exam.ownerId !== ownerId) {
            return NextResponse.json({ error: '시험지를 찾을 수 없습니다.' }, { status: 404 });
        }
        await prisma.examSet.delete({ where: { id: exam.id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete ExamSet Error:', error);
        return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }
}
