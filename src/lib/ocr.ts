import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export async function performOCRFromBuffer(imageBuffer: Buffer, filename: string = 'image.png'): Promise<string> {
    const invokeUrl = process.env.CLOVA_OCR_INVOKE_URL;
    const secretKey = process.env.CLOVA_OCR_SECRET_KEY;

    if (!invokeUrl || !secretKey) {
        throw new Error('CLOVA OCR 환경변수가 설정되지 않았습니다.');
    }

    try {
        const base64Image = imageBuffer.toString('base64');
        const ext = path.extname(filename).replace('.', '') || 'png';

        const payload = {
            version: 'V2',
            requestId: uuidv4(),
            timestamp: Date.now(),
            lang: 'ko',
            images: [
                {
                    format: ext,
                    name: 'demo',
                    data: base64Image
                }
            ]
        };

        const response = await fetch(invokeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-OCR-SECRET': secretKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('CLOVA OCR Error:', errText);
            throw new Error(`CLOVA OCR 실패: ${response.status}`);
        }

        const data = await response.json();
        
        // Extract text from the result
        let extractedText = '';
        if (data.images && data.images[0] && data.images[0].fields) {
            extractedText = data.images[0].fields.map((field: any) => field.inferText).join(' ');
        }

        return extractedText;
    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    }
}
