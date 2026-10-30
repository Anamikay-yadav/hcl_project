import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import { PdfAnalysisResult } from './pdf-analysis';

export interface PdfAnalysisReport extends PdfAnalysisResult {
  report_id: string;
  filename: string;
  analyzed_at: string;
  original_file_size: number;
  summary: string;
  extraction_errors: string[];
  analysis_errors: string[];
  skipped_reviews: string[];
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT = 44;
const RIGHT = PAGE_WIDTH - LEFT;
const BOTTOM = 48;
const NAVY = rgb(0.08, 0.18, 0.34);
const MUTED = rgb(0.35, 0.40, 0.48);
const GRID = rgb(0.84, 0.87, 0.91);

function fontPaths(): { regular: string; bold: string } | null {
  const windowsFonts = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
  const candidates = [
    {
      regular: path.join(windowsFonts, 'arial.ttf'),
      bold: path.join(windowsFonts, 'arialbd.ttf'),
    },
    {
      regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    },
    {
      regular: '/Library/Fonts/Arial.ttf',
      bold: '/Library/Fonts/Arial Bold.ttf',
    },
  ];
  return candidates.find(candidate => existsSync(candidate.regular) && existsSync(candidate.bold)) ?? null;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function createPdfAnalysisReport(
  report: PdfAnalysisReport,
  originalPdf?: Buffer
): Promise<Buffer> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);

  const fonts = fontPaths();
  if (!fonts) {
    throw new Error('A Unicode TrueType font is required to generate the analysis report.');
  }

  const regular = await document.embedFont(readFileSync(fonts.regular), { subset: true });
  const bold = await document.embedFont(readFileSync(fonts.bold), { subset: true });
  const extractionErrors = report.extraction_errors ?? [];
  const analysisErrors = report.analysis_errors ?? [];
  const skippedReviews = report.skipped_reviews ?? [];
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let cursor = 0;

  const addPage = (continued = false) => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    page.drawText(
      continued ? 'Bank Muscat Customer Review Sentiment Analyzer' : 'Bank Muscat Customer Review Sentiment Analyzer',
      { x: LEFT, y: PAGE_HEIGHT - 38, size: 10, font: bold, color: NAVY }
    );
    page.drawText(continued ? 'Complete PDF Analysis Report (continued)' : 'Complete PDF Analysis Report', {
      x: LEFT,
      y: PAGE_HEIGHT - 57,
      size: continued ? 11 : 19,
      font: bold,
      color: NAVY,
    });
    page.drawLine({
      start: { x: LEFT, y: PAGE_HEIGHT - 67 },
      end: { x: RIGHT, y: PAGE_HEIGHT - 67 },
      thickness: 1,
      color: GRID,
    });
    cursor = PAGE_HEIGHT - 86;
  };

  const ensureSpace = (height: number) => {
    if (cursor - height < BOTTOM) addPage(true);
  };

  const drawParagraph = (text: string, font = regular, size = 9, lineHeight = 12, indent = 0) => {
    const lines = wrapText(text, font, size, RIGHT - LEFT - indent);
    for (const line of lines) {
      ensureSpace(lineHeight);
      if (line) {
        page.drawText(line, { x: LEFT + indent, y: cursor - size, size, font, color: NAVY });
      }
      cursor -= lineHeight;
    }
  };

  const drawHeading = (heading: string) => {
    ensureSpace(28);
    cursor -= 5;
    page.drawText(heading, { x: LEFT, y: cursor - 13, size: 12, font: bold, color: NAVY });
    cursor -= 23;
  };

  addPage();
  drawParagraph(`Uploaded PDF: ${report.filename}`, bold, 10, 15);
  drawParagraph(`Analysis date and time: ${new Date(report.analyzed_at).toLocaleString()}`, regular, 9, 14);
  drawParagraph(`Original document: ${report.page_count} pages · ${(report.original_file_size / 1024).toFixed(1)} KB`, regular, 9, 14);
  drawParagraph(
    `Extracted reviews: ${report.total_reviews} · Successfully analyzed: ${report.successfully_analyzed_reviews}`,
    regular,
    9,
    14
  );
  drawParagraph(`Overall sentiment: ${report.sentiment} · ${report.confidence}% confidence`, bold, 11, 17);
  drawParagraph(report.summary, regular, 9, 13);

  drawHeading('Sentiment distribution');
  const chartWidth = RIGHT - LEFT - 184;
  const distributionColors: Record<string, ReturnType<typeof rgb>> = {
    Positive: rgb(0.12, 0.58, 0.39),
    Negative: rgb(0.82, 0.22, 0.25),
    Neutral: rgb(0.36, 0.43, 0.54),
  };
  for (const sentiment of ['Positive', 'Negative', 'Neutral']) {
    const item = report.sentiment_distribution[sentiment] ?? { count: 0, percentage: 0 };
    ensureSpace(24);
    page.drawText(sentiment, { x: LEFT, y: cursor - 10, size: 8, font: bold, color: NAVY });
    page.drawRectangle({
      x: LEFT + 70,
      y: cursor - 12,
      width: chartWidth,
      height: 8,
      color: GRID,
    });
    if (item.percentage > 0) {
      page.drawRectangle({
        x: LEFT + 70,
        y: cursor - 12,
        width: chartWidth * item.percentage / 100,
        height: 8,
        color: distributionColors[sentiment],
      });
    }
    page.drawText(`${item.count} (${item.percentage}%)`, {
      x: LEFT + 78 + chartWidth,
      y: cursor - 10,
      size: 8,
      font: regular,
      color: MUTED,
    });
    cursor -= 22;
  }

  drawHeading('Complete extracted text');
  drawParagraph(report.extracted_text, regular, 8, 10);

  drawHeading('Individual review analysis');
  const idWidth = 94;
  const sentimentWidth = 70;
  const confidenceWidth = 58;
  const textWidth = RIGHT - LEFT - idWidth - sentimentWidth - confidenceWidth - 12;
  const tableHeader = () => {
    ensureSpace(24);
    page.drawRectangle({ x: LEFT, y: cursor - 19, width: RIGHT - LEFT, height: 20, color: NAVY });
    page.drawText('Review ID', { x: LEFT + 4, y: cursor - 13, size: 7, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Sentiment', { x: LEFT + idWidth, y: cursor - 13, size: 7, font: bold, color: rgb(1, 1, 1) });
    page.drawText('Confidence', {
      x: LEFT + idWidth + sentimentWidth,
      y: cursor - 13,
      size: 7,
      font: bold,
      color: rgb(1, 1, 1),
    });
    page.drawText('Complete extracted review text', {
      x: LEFT + idWidth + sentimentWidth + confidenceWidth,
      y: cursor - 13,
      size: 7,
      font: bold,
      color: rgb(1, 1, 1),
    });
    cursor -= 24;
  };
  tableHeader();

  for (const review of report.chunks) {
    const lines = wrapText(review.text, regular, 8, textWidth);
    let lineIndex = 0;
    let firstPart = true;
    while (lineIndex < lines.length) {
      const lineHeight = 10;
      const availableLines = Math.floor((cursor - BOTTOM - 12) / lineHeight);
      if (availableLines < 1) {
        addPage(true);
        tableHeader();
        continue;
      }
      const part = lines.slice(lineIndex, lineIndex + availableLines);
      const rowHeight = Math.max(22, part.length * lineHeight + 8);
      const yTop = cursor;
      if (firstPart) {
        page.drawText(review.review_id, {
          x: LEFT + 4,
          y: yTop - 14,
          size: 7,
          font: regular,
          color: NAVY,
          maxWidth: idWidth - 8,
        });
        page.drawText(review.sentiment, {
          x: LEFT + idWidth,
          y: yTop - 14,
          size: 7,
          font: bold,
          color: distributionColors[review.sentiment] ?? NAVY,
          maxWidth: sentimentWidth - 4,
        });
        page.drawText(`${review.confidence}%`, {
          x: LEFT + idWidth + sentimentWidth,
          y: yTop - 14,
          size: 7,
          font: regular,
          color: NAVY,
        });
      }
      part.forEach((line, index) => {
        if (line) {
          page.drawText(line, {
            x: LEFT + idWidth + sentimentWidth + confidenceWidth,
            y: yTop - 13 - index * lineHeight,
            size: 8,
            font: regular,
            color: NAVY,
          });
        }
      });
      cursor -= rowHeight;
      page.drawLine({
        start: { x: LEFT, y: cursor },
        end: { x: RIGHT, y: cursor },
        thickness: 0.5,
        color: GRID,
      });
      lineIndex += part.length;
      firstPart = false;
      if (lineIndex < lines.length) {
        addPage(true);
        tableHeader();
      }
    }
  }

  drawHeading('Extraction errors and skipped reviews');
  drawParagraph(
    extractionErrors.length
      ? extractionErrors.join('\n')
      : 'No extraction errors were reported.',
    regular,
    8,
    11
  );
  drawParagraph(
    analysisErrors.length
      ? analysisErrors.join('\n')
      : 'No sentiment prediction errors were reported.',
    regular,
    8,
    11
  );
  drawParagraph(
    skippedReviews.length
      ? skippedReviews.map(reviewId => `Review ID: ${reviewId}`).join('\n')
      : 'No reviews were skipped; all extracted review items were analyzed.',
    regular,
    8,
    11
  );

  if (originalPdf) {
    const original = await PDFDocument.load(originalPdf);
    const copiedPages = await document.copyPages(original, original.getPageIndices());
    copiedPages.forEach(originalPage => document.addPage(originalPage));
  }

  pages.forEach((reportPage, index) => {
    reportPage.drawLine({
      start: { x: LEFT, y: 34 },
      end: { x: RIGHT, y: 34 },
      thickness: 0.7,
      color: GRID,
    });
    reportPage.drawText(`Report ${report.report_id}  ·  Page ${index + 1} of ${document.getPageCount()}`, {
      x: LEFT,
      y: 21,
      size: 7,
      font: regular,
      color: MUTED,
    });
  });

  return Buffer.from(await document.save());
}
