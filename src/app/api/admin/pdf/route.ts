import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/session';

const FORBIDDEN = NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50MB

// 새 PDF 업로드 (또는 동일 hash 기존 PDF 반환)
export async function POST(request: NextRequest) {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const pageCount = formData.get('pageCount');
        if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
        if (file.size > MAX_PDF_BYTES) {
            return NextResponse.json({ error: 'PDF 파일은 50MB 이하만 업로드 가능합니다.' }, { status: 413 });
        }
        if (file.type && file.type !== 'application/pdf') {
            return NextResponse.json({ error: 'PDF 파일만 업로드 가능합니다.' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 중복 감지 — SHA-256 hash
        const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
        const existing = await prisma.pdfDocument.findUnique({ where: { fileHash } });
        if (existing) {
            return NextResponse.json({ ...existing, deduped: true });
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = `pdfs/${uuidv4()}-${safeName}`;
        const blob = await put(key, buffer, {
            access: 'public',
            contentType: 'application/pdf',
        });

        const created = await prisma.pdfDocument.create({
            data: {
                name: file.name,
                blobUrl: blob.url,
                fileHash,
                pageCount: pageCount ? parseInt(String(pageCount)) : null,
            },
        });
        return NextResponse.json(created);
    } catch (e) {
        console.error('PDF upload error:', e);
        return NextResponse.json({ error: 'PDF 업로드 실패' }, { status: 500 });
    }
}

// 최근 PDF 목록 (각 PDF의 저장된 카드 수 포함)
export async function GET() {
    if (!(await requireAdmin())) return FORBIDDEN;
    try {
        const list = await prisma.pdfDocument.findMany({
            orderBy: { createdAt: 'desc' },
            take: 30,
            include: {
                _count: { select: { passages: true, questions: true } },
            },
        });
        return NextResponse.json(list);
    } catch (e) {
        console.error('PDF list error:', e);
        return NextResponse.json({ error: 'PDF 목록 조회 실패' }, { status: 500 });
    }
}
