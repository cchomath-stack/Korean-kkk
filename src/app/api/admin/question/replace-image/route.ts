import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// 문항 이미지를 통째로 교체.
// multipart/form-data: file + questionId
export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const questionIdRaw = formData.get('questionId') as string | null;

        if (!file || !questionIdRaw) {
            return NextResponse.json({ error: 'file/questionId 필요.' }, { status: 400 });
        }
        if (file.size > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: '이미지는 15MB 이하만 업로드 가능합니다.' }, { status: 413 });
        }
        if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type)) {
            return NextResponse.json({ error: '지원하지 않는 이미지 형식입니다.' }, { status: 400 });
        }

        const qid = parseInt(questionIdRaw, 10);
        const question = await prisma.question.findUnique({ where: { id: qid } });
        if (!question) {
            return NextResponse.json({ error: '문항을 찾을 수 없습니다.' }, { status: 404 });
        }

        const bytes = await file.arrayBuffer();
        const originalBuffer = Buffer.from(bytes);

        // 초압축: 흑백 + 팔레트 PNG (텍스트 문제 이미지에 최적)
        const compressed = await sharp(originalBuffer)
            .grayscale()
            .png({ palette: true, quality: 80 })
            .toBuffer();

        const originalName = file.name.replace(/\.[^/.]+$/, '');
        const filename = `${uuidv4()}-q${qid}-${originalName}.png`;
        const blob = await put(`uploads/${filename}`, compressed as Buffer, {
            access: 'public',
            contentType: 'image/png',
        });

        const updated = await prisma.question.update({
            where: { id: qid },
            data: { imageUrl: blob.url },
        });

        return NextResponse.json({ question: updated, url: blob.url });
    } catch (error: any) {
        console.error('Replace Image Error:', error);
        return NextResponse.json({ error: '이미지 교체 실패', detail: error?.message || String(error) }, { status: 500 });
    }
}
