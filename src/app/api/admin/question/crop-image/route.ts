import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 30;

// 서버 사이드 crop (Question용).
// body: { questionId, sourceUrl, u1, v1, u2, v2 } (u,v = 0~1 원본 이미지 대비 상대 좌표)
// 서버가 sourceUrl에서 이미지 fetch → sharp로 그 영역 crop → PNG → Vercel Blob 업로드 → Question.imageUrl 갱신
export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    try {
        const body = await request.json();
        const { questionId, sourceUrl, u1, v1, u2, v2 } = body || {};
        if (!questionId || !sourceUrl) {
            return NextResponse.json({ error: 'questionId/sourceUrl 필요.' }, { status: 400 });
        }
        const uu1 = clamp01(u1), vv1 = clamp01(v1), uu2 = clamp01(u2), vv2 = clamp01(v2);
        if (uu2 - uu1 < 0.01 || vv2 - vv1 < 0.01) {
            return NextResponse.json({ error: '자르기 영역이 너무 작습니다.' }, { status: 400 });
        }

        const question = await prisma.question.findUnique({ where: { id: parseInt(String(questionId), 10) } });
        if (!question) {
            return NextResponse.json({ error: '문항을 찾을 수 없습니다.' }, { status: 404 });
        }

        const res = await fetch(sourceUrl);
        if (!res.ok) {
            return NextResponse.json({ error: '원본 이미지를 가져오지 못했습니다.', detail: res.statusText }, { status: 502 });
        }
        const buffer = Buffer.from(await res.arrayBuffer());

        const meta = await sharp(buffer).metadata();
        const W = meta.width || 0;
        const H = meta.height || 0;
        if (!W || !H) {
            return NextResponse.json({ error: '이미지 크기를 알 수 없습니다.' }, { status: 400 });
        }
        const sx = Math.max(0, Math.floor(W * uu1));
        const sy = Math.max(0, Math.floor(H * vv1));
        const sw = Math.max(1, Math.floor(W * (uu2 - uu1)));
        const sh = Math.max(1, Math.floor(H * (vv2 - vv1)));

        const cropped = await sharp(buffer)
            .extract({ left: sx, top: sy, width: Math.min(sw, W - sx), height: Math.min(sh, H - sy) })
            .png()
            .toBuffer();

        const filename = `${uuidv4()}-q${question.id}-cropped.png`;
        const blob = await put(`uploads/${filename}`, cropped as Buffer, {
            access: 'public',
            contentType: 'image/png',
        });

        const updated = await prisma.question.update({
            where: { id: question.id },
            data: { imageUrl: blob.url },
        });

        return NextResponse.json({ question: updated, url: blob.url });
    } catch (error: any) {
        console.error('Question Crop Error:', error);
        return NextResponse.json({ error: '자르기 실패', detail: error?.message || String(error) }, { status: 500 });
    }
}

function clamp01(v: any): number {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}
