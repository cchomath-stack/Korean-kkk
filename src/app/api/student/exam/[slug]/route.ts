import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 학생용 공개: slug로 시험지 조회 (문제 목록 + 이미지 썸네일).
// 정답/해설/OCR 등 민감 정보는 제외.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        if (!slug) return NextResponse.json({ error: 'slug가 필요합니다.' }, { status: 400 });

        const exam = await prisma.examSet.findUnique({
            where: { studentAccessSlug: slug },
            include: {
                items: { orderBy: { order: 'asc' } },
            },
        });
        if (!exam || !exam.isStudentPublic) {
            return NextResponse.json({ error: '해당 링크의 시험지를 찾을 수 없습니다.' }, { status: 404 });
        }

        // items에 이미지 정보를 hydrate (학생 화면 그리드용)
        const passageIds = exam.items
            .filter(i => i.kind === 'passage' && i.passageId)
            .map(i => i.passageId!);
        const questionIds = exam.items
            .filter(i => i.kind === 'question' && i.questionId)
            .map(i => i.questionId!);
        const [passages, questions] = await Promise.all([
            passageIds.length > 0
                ? prisma.passage.findMany({
                    where: { id: { in: passageIds } },
                    select: {
                        id: true, imageUrl: true, year: true, month: true, grade: true, questionRange: true,
                        images: { orderBy: { order: 'asc' }, select: { imageUrl: true, order: true } },
                        questions: {
                            orderBy: { questionNo: 'asc' },
                            select: { id: true, imageUrl: true, questionNo: true },
                        },
                    },
                })
                : Promise.resolve([]),
            questionIds.length > 0
                ? prisma.question.findMany({
                    where: { id: { in: questionIds } },
                    select: {
                        id: true, imageUrl: true, questionNo: true,
                        year: true, month: true, grade: true, area: true, passageId: true,
                    },
                })
                : Promise.resolve([]),
        ]);
        const pMap = new Map(passages.map(p => [p.id, p]));
        const qMap = new Map(questions.map(q => [q.id, q]));

        const items = exam.items.map(it => ({
            id: it.id,
            kind: it.kind,
            order: it.order,
            imageUrl: it.croppedImageUrl || (it.kind === 'passage'
                ? (pMap.get(it.passageId ?? -1)?.imageUrl || pMap.get(it.passageId ?? -1)?.images?.[0]?.imageUrl)
                : qMap.get(it.questionId ?? -1)?.imageUrl) || null,
            passage: it.kind === 'passage' && it.passageId ? pMap.get(it.passageId) ?? null : null,
            question: it.kind === 'question' && it.questionId ? qMap.get(it.questionId) ?? null : null,
        }));

        return NextResponse.json({
            id: exam.id,
            title: exam.title,
            subTitle: exam.subTitle,
            grade: exam.grade,
            academyName: exam.academyName,
            items,
        });
    } catch (error: any) {
        console.error('Student Exam Fetch Error:', error);
        return NextResponse.json({ error: '조회 실패', detail: error?.message }, { status: 500 });
    }
}

// 학생 제출: body { slug, studentName, studentPhone, studentAcademy, wrongItemIds: number[] }
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const body = await request.json();
        const { studentName, studentPhone, studentAcademy, wrongItemIds } = body;

        if (!studentName?.trim()) {
            return NextResponse.json({ error: '이름이 필요합니다.' }, { status: 400 });
        }
        if (!Array.isArray(wrongItemIds) || wrongItemIds.length === 0) {
            return NextResponse.json({ error: '틀린 문제를 1개 이상 체크해주세요.' }, { status: 400 });
        }

        const exam = await prisma.examSet.findUnique({ where: { studentAccessSlug: slug } });
        if (!exam || !exam.isStudentPublic) {
            return NextResponse.json({ error: '시험지를 찾을 수 없습니다.' }, { status: 404 });
        }

        // wrongItemIds 유효성: 시험지에 속한 ExamItem만 통과
        const ids = wrongItemIds.map((v: any) => parseInt(String(v), 10)).filter((n: number) => !isNaN(n));
        const validItems = await prisma.examItem.findMany({
            where: { id: { in: ids }, examSetId: exam.id },
            select: { id: true },
        });
        if (validItems.length === 0) {
            return NextResponse.json({ error: '유효한 문제 항목이 없습니다.' }, { status: 400 });
        }

        const submission = await prisma.wrongNoteSubmission.create({
            data: {
                examSetId: exam.id,
                studentName: studentName.trim(),
                studentPhone: studentPhone?.trim() || null,
                studentAcademy: studentAcademy?.trim() || null,
                answers: {
                    create: validItems.map(v => ({ examItemId: v.id })),
                },
            },
        });

        return NextResponse.json({
            success: true,
            submissionId: submission.id,
            message: '제출 완료. 학원에서 오답노트를 받아 보실 수 있습니다.',
        });
    } catch (error: any) {
        console.error('Student Submit Error:', error);
        return NextResponse.json({ error: '제출 실패', detail: error?.message }, { status: 500 });
    }
}
