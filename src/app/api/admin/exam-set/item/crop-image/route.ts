import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

const MAX = 15 * 1024 * 1024;

// 클라이언트에서 canvas로 자른 이미지 blob을 받아 Vercel Blob에 저장하고
// ExamItem.croppedImageUrl을 갱신한다. (또한 cropTop/Bottom/Left/Right는 0으로 리셋 —
// 이미지 자체가 이미 잘렸으므로 CSS crop 필요 없음)
export async function POST(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    const ownerId = Number(session.userId);
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const itemIdRaw = formData.get('itemId');
        const examSetIdRaw = formData.get('examSetId');
        if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
        if (!itemIdRaw || !examSetIdRaw) return NextResponse.json({ error: 'itemId/examSetId가 필요합니다.' }, { status: 400 });
        if (file.size > MAX) return NextResponse.json({ error: '이미지가 너무 큽니다.' }, { status: 413 });

        const itemId = parseInt(String(itemIdRaw), 10);
        const examSetId = parseInt(String(examSetIdRaw), 10);

        const exam = await prisma.examSet.findUnique({ where: { id: examSetId } });
        if (!exam || exam.ownerId !== ownerId) {
            return NextResponse.json({ error: '시험지를 찾을 수 없습니다.' }, { status: 404 });
        }
        const item = await prisma.examItem.findUnique({ where: { id: itemId } });
        if (!item || item.examSetId !== examSetId) {
            return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
        }

        const bytes = await file.arrayBuffer();
        const filename = `${uuidv4()}-cropped.png`;
        const blob = await put(`uploads/${filename}`, Buffer.from(bytes) as Buffer, {
            access: 'public',
            contentType: 'image/png',
        });

        // crop 값 리셋 (이미지 자체가 이미 잘림)
        const updated = await prisma.examItem.update({
            where: { id: itemId },
            data: {
                croppedImageUrl: blob.url,
                cropTop: 0,
                cropBottom: 0,
                cropLeft: 0,
                cropRight: 0,
            },
        });
        return NextResponse.json({ item: updated, url: blob.url });
    } catch (error: any) {
        console.error('Crop Image Upload Error:', error);
        return NextResponse.json({ error: '자르기 저장 실패', detail: error?.message || String(error) }, { status: 500 });
    }
}
