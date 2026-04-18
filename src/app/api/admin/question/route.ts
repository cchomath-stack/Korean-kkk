import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('Save Question Request Body:', body);

        const { passageId, imageUrl, ocrText, keywords, answer, difficulty, questionNo } = body;

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
            },
        });

        console.log('Question Saved Successfully:', question.id);
        return NextResponse.json(question);
    } catch (error: any) {
        console.error('Save Question Error:', error);
        return NextResponse.json({
            error: '문제 저장에 실패했습니다.',
            details: error.message
        }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
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
    } catch (error: any) {
        return NextResponse.json({ error: '수정 실패', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

        await prisma.question.delete({
            where: { id: parseInt(id) }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: '삭제 실패', details: error.message }, { status: 500 });
    }
}
