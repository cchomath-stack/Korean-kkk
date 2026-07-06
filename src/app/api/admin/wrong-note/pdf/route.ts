import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function getBrowser() {
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        const puppeteer = (await import('puppeteer-core')).default;
        const chromium: any = (await import('@sparticuz/chromium')).default;
        return puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true,
            defaultViewport: chromium.defaultViewport ?? null,
        });
    }
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
    const found = candidatePaths.find(p => { try { return fs.existsSync(p); } catch { return false; } });
    if (!found) throw new Error('로컬에 Chrome/Edge가 설치돼 있어야 합니다.');
    return puppeteerCore.launch({
        executablePath: found,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
}

export async function GET(request: NextRequest) {
    if (!(await requireAdmin())) {
        return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 });

    let browser: any = null;
    try {
        const submission = await prisma.wrongNoteSubmission.findUnique({
            where: { id: parseInt(id, 10) },
            include: {
                examSet: true,
                answers: { include: { examItem: true } },
            },
        });
        if (!submission) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });

        const passageIds = submission.answers
            .filter(a => a.examItem.kind === 'passage' && a.examItem.passageId)
            .map(a => a.examItem.passageId!);
        const questionIds = submission.answers
            .filter(a => a.examItem.kind === 'question' && a.examItem.questionId)
            .map(a => a.examItem.questionId!);

        const [passages, questions] = await Promise.all([
            passageIds.length > 0
                ? prisma.passage.findMany({
                    where: { id: { in: passageIds } },
                    include: { images: { orderBy: { order: 'asc' } }, questions: { orderBy: { questionNo: 'asc' } } },
                })
                : Promise.resolve([]),
            questionIds.length > 0
                ? prisma.question.findMany({
                    where: { id: { in: questionIds } },
                    include: { passage: { select: { id: true, year: true, month: true, grade: true, area: true } } },
                })
                : Promise.resolve([]),
        ]);
        const pMap = new Map(passages.map(p => [p.id, p]));
        const qMap = new Map(questions.map(q => [q.id, q]));
        const hydratedAnswers = submission.answers
            .sort((a, b) => a.examItem.order - b.examItem.order)
            .map(a => ({
                ...a,
                passage: a.examItem.kind === 'passage' && a.examItem.passageId ? pMap.get(a.examItem.passageId) ?? null : null,
                question: a.examItem.kind === 'question' && a.examItem.questionId ? qMap.get(a.examItem.questionId) ?? null : null,
            }));
        const hydrated = { ...submission, answers: hydratedAnswers };

        const [{ renderToStaticMarkup }, React, { WrongNotePaper }] = await Promise.all([
            import('react-dom/server'),
            import('react'),
            import('@/components/WrongNotePaper'),
        ]);
        const bodyHtml = renderToStaticMarkup(
            React.createElement(WrongNotePaper, { data: hydrated as any })
        );

        const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>오답노트 — ${escapeHtml(submission.studentName)}</title>
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.6/dist/web/static/pretendard.min.css">
<style>
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: white; }
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

        const filename = `오답노트_${submission.studentName.replace(/[\\/:*?"<>|]/g, '_')}_${submission.id}.pdf`;
        return new NextResponse(pdf, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error: any) {
        console.error('WrongNote PDF Error:', error);
        if (browser) { try { await browser.close(); } catch { } }
        return NextResponse.json({ error: 'PDF 생성 실패', detail: error?.message || String(error) }, { status: 500 });
    }
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
