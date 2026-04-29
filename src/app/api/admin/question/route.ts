import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });

export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();

        const {
            passageId, imageUrl, ocrText,
            keywords, answer, difficulty, questionNo,
            tags, // string[]
            pdfDocumentId,
            pageNum, boxX, boxY, boxW, boxH,
        } = body;

        if (!imageUrl) {
            return NextResponse.json({ error: '이미지 URL이 필요합니다.' }, { status: 400 });
        }

        const question = await prisma.question.create({
            data: {
                passageId: passageId ? parseInt(String(passageId)) : null,
                imageUrl,
                ocrText,
                keywords,
                answer,
                difficulty,
                questionNo: questionNo ? parseInt(String(questionNo)) : null,
                pdfDocumentId: pdfDocumentId ? parseInt(String(pdfDocumentId)) : null,
                pageNum: pageNum ?? null,
                boxX: boxX ?? null,
                boxY: boxY ?? null,
                boxW: boxW ?? null,
                boxH: boxH ?? null,
                ...(Array.isArray(tags) && tags.length > 0 && {
                    tags: {
                        create: await connectTagsForQuestion(tags),
                    },
                }),
            },
            include: { tags: { include: { tag: true } } },
        });

        return NextResponse.json(question);
    } catch (error) {
        console.error('Save Question Error:', error);
        return NextResponse.json({ error: '문제 저장에 실패했습니다.' }, { status: 500 });
    }
}

async function connectTagsForQuestion(names: string[]): Promise<{ tagId: number }[]> {
    const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    const result: { tagId: number }[] = [];
    for (const name of cleaned) {
        const t = await prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name },
        });
        result.push({ tagId: t.id });
    }
    return result;
}

export async function PUT(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const body = await request.json();
        const { id, ...data } = body;

        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

        const updated = await prisma.question.update({
            where: { id: parseInt(String(id)) },
            data: {
                ...data,
                questionNo: data.questionNo ? parseInt(String(data.questionNo)) : null,
            }
        });
        return NextResponse.json(updated);
    } catch (error) {
        console.error('Update Question Error:', error);
        return NextResponse.json({ error: '수정 실패' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

        await prisma.question.delete({
            where: { id: parseInt(id) }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete Question Error:', error);
        return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }
}
