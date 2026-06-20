import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ExamPaper } from '@/components/ExamPaper';

// Puppeteer + Chromium은 Node.js 런타임에서만 동작 (Edge 런타임 불가)
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Vercel serverless / Node 환경에 따라 다른 puppeteer 로드 전략 사용
async function getBrowser() {
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        // Vercel serverless: @sparticuz/chromium + puppeteer-core
        const puppeteer = (await import('puppeteer-core')).default;
        const chromium: any = (await import('@sparticuz/chromium')).default;
        return puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
            defaultViewport: chromium.defaultViewport ?? null,
        });
    }
    // 로컬 개발: 시스템 Chromium / Chrome 사용 시도
    const puppeteerCore = (await import('puppeteer-core')).default;
    const candidatePaths = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean) as string[];

    const fs = await import('fs');
    const found = candidatePaths.find(p => {
        try { return fs.existsSync(p); } catch { return false; }
    });
    if (!found) {
        throw new Error('로컬에 Chrome/Edge가 설치돼 있어야 합니다. PUPPETEER_EXECUTABLE_PATH 환경변수를 설정해주세요.');
    }
    return puppeteerCore.launch({
        executablePath: found,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
}

export async function GET(request: NextRequest) {
    const session = await requireAdmin();
    if (!session) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    const ownerId = Number(session.userId);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const showOriginalNo = searchParams.get('showOriginalNo') !== '0';
    if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

    let browser: any = null;
    try {
        // hydrated 데이터 로드
        const exam = await prisma.examSet.findUnique({
            where: { id: parseInt(id, 10) },
            include: { items: { orderBy: { order: 'asc' } } },
        });
        if (!exam || exam.ownerId !== ownerId) {
            return NextResponse.json({ error: '시험지를 찾을 수 없습니다.' }, { status: 404 });
        }

        const passageIds = exam.items.filter(i => i.kind === 'passage' && i.passageId).map(i => i.passageId!);
        const questionIds = exam.items.filter(i => i.kind === 'question' && i.questionId).map(i => i.questionId!);
        const [passages, questions] = await Promise.all([
            passageIds.length > 0
                ? prisma.passage.findMany({
                    where: { id: { in: passageIds } },
                    include: {
                        images: { orderBy: { order: 'asc' } },
                        questions: { orderBy: { questionNo: 'asc' } },
                    },
                })
                : Promise.resolve([]),
            questionIds.length > 0
                ? prisma.question.findMany({
                    where: { id: { in: questionIds } },
                })
                : Promise.resolve([]),
        ]);
        const passageMap = new Map(passages.map(p => [p.id, p]));
        const questionMap = new Map(questions.map(q => [q.id, q]));
        const hydratedItems = exam.items.map(it => ({
            ...it,
            passage: it.kind === 'passage' && it.passageId ? passageMap.get(it.passageId) ?? null : null,
            question: it.kind === 'question' && it.questionId ? questionMap.get(it.questionId) ?? null : null,
        }));
        const hydratedExam = { ...exam, items: hydratedItems };

        // ExamPaper 컴포넌트를 SSR로 정적 HTML 생성
        const bodyHtml = renderToStaticMarkup(
            React.createElement(ExamPaper, { exam: hydratedExam as any, showOriginalNo })
        );

        const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escapeHtml(exam.title || '시험지')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&family=Nanum+Myeongjo:wght@400;700;800&display=swap" rel="stylesheet">
<style>
html, body { margin: 0; padding: 0; }
body { background: white; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

        browser = await getBrowser();
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });
        await page.close();
        await browser.close();
        browser = null;

        return new NextResponse(pdf, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="exam-${exam.id}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: any) {
        console.error('PDF Generation Error:', error);
        if (browser) {
            try { await browser.close(); } catch {}
        }
        return NextResponse.json(
            { error: 'PDF 생성에 실패했습니다.', detail: error?.message || String(error) },
            { status: 500 }
        );
    }
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
