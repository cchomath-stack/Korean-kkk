import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { put } from '@vercel/blob';
import { performOCRFromBuffer } from '@/lib/ocr';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const originalBuffer = Buffer.from(bytes);

        // 초압축: 흑백(Grayscale) 처리 후 팔레트를 사용하는 PNG(Lossy/Lossless 혼합 기반 최적화)로 변환
        // 원본 대비 크기를 70~90% 감소시키면서 글자 선명도 유지
        const compressedBuffer = await sharp(originalBuffer)
            .grayscale()
            .png({ palette: true, quality: 80 })
            .toBuffer();

        const originalName = file.name.replace(/\.[^/.]+$/, "");
        const filename = `${uuidv4()}-${originalName}.png`;
        
        // Vercel Blob 업로드
        const blob = await put(`uploads/${filename}`, compressedBuffer as Buffer, {
            access: 'public',
            contentType: 'image/png'
        });
        
        const imageUrl = blob.url;

        // CLOVA OCR 실행
        let ocrText = '';
        try {
            ocrText = await performOCRFromBuffer(compressedBuffer, file.name);
        } catch (ocrError: any) {
            console.error('OCR processing failed:', ocrError);
            ocrText = '(OCR 추출 실패)';
        }

        return NextResponse.json({ imageUrl, ocrText });
    } catch (error) {
        console.error('Upload API Error:', error);
        return NextResponse.json({ error: '파일 업로드에 실패했습니다.' }, { status: 500 });
    }
}
