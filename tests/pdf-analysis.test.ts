import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import {
  analyzePdf,
  extractPdfText,
  MAX_PDF_BYTES,
  pdfProcessingError,
  PdfUploadError,
  splitIntoChunks,
  validatePdfBuffer,
} from '../server/pdf-analysis';
import { createImageOnlyPdf, createTextPdf } from './pdf-fixtures';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let serverProcess: ChildProcess | undefined;
let serverUrl = '';

async function findAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate a test port.');
  const { port } = address;
  await new Promise<void>((resolveClose, reject) => {
    server.close(error => (error ? reject(error) : resolveClose()));
  });
  return port;
}

async function waitForBackend(): Promise<void> {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error('The test backend exited before becoming ready.');
    }
    try {
      const response = await fetch(`${serverUrl}/api/health`);
      const health = await response.json();
      if (response.ok && health.status === 'healthy' && health.model_loaded) return;
    } catch {
      await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
      continue;
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
  }
  throw new Error('The test backend did not become ready within 60 seconds.');
}

before(async () => {
  const port = await findAvailablePort();
  serverUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      MONGODB_URI: 'mongodb://127.0.0.1:1/pdf_report_tests',
    },
    stdio: 'ignore',
  });
  await waitForBackend();
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await new Promise<void>(resolveExit => {
      const timeout = setTimeout(resolveExit, 5000);
      serverProcess?.once('exit', () => {
        clearTimeout(timeout);
        resolveExit();
      });
    });
    if (serverProcess.exitCode === null) serverProcess.kill('SIGKILL');
  }
});

async function uploadPdf(
  buffer: Buffer,
  contentType = 'application/pdf',
  filename = 'test.pdf'
) {
  const response = await fetch(`${serverUrl}/api/sentiment/analyze-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'X-PDF-Filename': encodeURIComponent(filename) },
    body: new Uint8Array(buffer),
  });
  return { response, body: await response.json() };
}

test('preserves the existing text sentiment analysis endpoint', async () => {
  const response = await fetch(`${serverUrl}/api/sentiment/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_text: 'The replacement card arrived earlier than expected.', save_to_db: false }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.sentiment, 'Positive');
  assert.ok(body.confidence > 0);
});

test('extracts text and analyzes a one-page positive review with the existing model', async () => {
  const pdf = createTextPdf([
    'The mobile app is excellent and the staff were very helpful. I am delighted with the fast service.',
  ]);
  const { response, body } = await uploadPdf(pdf);

  assert.equal(response.status, 200);
  assert.equal(body.page_count, 1);
  assert.match(body.extracted_text, /mobile app is excellent/i);
  assert.equal(body.sentiment, 'Positive');
  assert.equal(body.chunks.length, 1);
  assert.ok(body.confidence > 0 && body.confidence <= 100);
});

test('analyzes each page of a multi-page PDF and reports positive, negative, and neutral chunks', async () => {
  const pdf = createTextPdf([
    'The mobile app is excellent and the staff were very helpful. I am delighted with the fast service.',
    'The recipient has not received the money although my account was debited.',
    'I used an ATM to withdraw cash this morning. This is an update about my recent banking activity.',
  ]);
  const { response, body } = await uploadPdf(pdf);

  assert.equal(response.status, 200);
  assert.equal(body.page_count, 3);
  assert.equal(body.chunks.length, 3);
  assert.deepEqual(body.chunks.map((chunk: { sentiment: string }) => chunk.sentiment), [
    'Positive',
    'Negative',
    'Neutral',
  ]);
  assert.ok(['Positive', 'Negative', 'Neutral'].includes(body.sentiment));
  assert.ok(body.probabilities.Positive !== undefined);
  assert.ok(body.probabilities.Negative !== undefined);
  assert.ok(body.probabilities.Neutral !== undefined);
});

test('persists all twelve identified reviews and provides PDF, combined, original, and CSV downloads', async () => {
  const reviews = Array.from({ length: 12 }, (_, index) => {
    const id = `BM-TEST-${String(index + 1).padStart(3, '0')}`;
    return `${id} | Service | 2026-08-${String(index + 1).padStart(2, '0')}\nCustomer review ${index + 1}: I used the bank service and this is my complete review text.`;
  });
  const originalPdf = createTextPdf([
    `Customer review test page 1\n${reviews.slice(0, 4).join('\n')}`,
    `Customer review test page 2\n${reviews.slice(4, 8).join('\n')}`,
    `Customer review test page 3\n${reviews.slice(8, 12).join('\n')}`,
  ]);
  const { response, body } = await uploadPdf(originalPdf, 'application/pdf', 'Bank_Muscat_12_Reviews.pdf');

  assert.equal(response.status, 200);
  assert.equal(body.filename, 'Bank_Muscat_12_Reviews.pdf');
  assert.equal(body.page_count, 3);
  assert.equal(body.total_reviews, 12);
  assert.equal(body.successfully_analyzed_reviews, 12);
  assert.equal(body.chunks.length, 12);
  assert.deepEqual(body.chunks.map((review: { review_id: string }) => review.review_id), reviews.map(item => item.slice(0, 11)));
  const actualDistribution: Record<string, { count: number; percentage: number }> = body.sentiment_distribution;
  assert.equal(Object.values(actualDistribution).reduce((total, entry) => total + entry.count, 0), 12);
  assert.ok(body.report_id);
  assert.ok(body.analyzed_at);

  const historyResponse = await fetch(`${serverUrl}/api/reports/pdf-analyses`);
  const history = await historyResponse.json();
  const saved = history.find((report: { report_id: string }) => report.report_id === body.report_id);
  assert.ok(saved);
  assert.equal(saved.filename, 'Bank_Muscat_12_Reviews.pdf');
  assert.equal(saved.successfully_analyzed_reviews, 12);
  const secondUpload = await uploadPdf(
    createTextPdf(['This is a distinct second report with its own analyzed review.']),
    'application/pdf',
    'second_report.pdf'
  );
  const updatedHistory = await (await fetch(`${serverUrl}/api/reports/pdf-analyses`)).json();
  assert.notEqual(secondUpload.body.report_id, body.report_id);
  assert.ok(updatedHistory.some((report: { report_id: string }) => report.report_id === body.report_id));
  assert.ok(updatedHistory.some((report: { report_id: string }) => report.report_id === secondUpload.body.report_id));

  const reportResponse = await fetch(
    `${serverUrl}/api/reports/pdf-analyses/${body.report_id}/download`
  );
  assert.equal(reportResponse.status, 200);
  assert.match(reportResponse.headers.get('content-type') || '', /application\/pdf/);
  const reportPdf = Buffer.from(await reportResponse.arrayBuffer());
  const parsedReport = await extractPdfText(reportPdf);
  const normalizedReport = parsedReport.text.replace(/\s+/g, ' ');
  assert.match(normalizedReport, /Complete PDF Analysis Report/);
  assert.match(normalizedReport, /Bank_Muscat_12_Reviews\.pdf/);
  assert.match(normalizedReport, /BM-TEST-001/);
  assert.match(normalizedReport, /BM-TEST-012/);
  assert.match(normalizedReport, /Customer review 12/);
  for (const [sentiment, distribution] of Object.entries(actualDistribution)) {
    assert.ok(normalizedReport.includes(sentiment));
    assert.ok(normalizedReport.includes(`${distribution.count} (${distribution.percentage}%)`));
  }
  for (const review of body.chunks) {
    assert.ok(normalizedReport.includes(review.text.replace(/\s+/g, ' ')));
    assert.ok(normalizedReport.includes(`${review.confidence}%`));
    assert.ok(normalizedReport.includes(review.sentiment));
  }
  assert.match(normalizedReport, /No extraction errors were reported/);
  assert.match(normalizedReport, /No reviews were skipped/);

  const csvResponse = await fetch(
    `${serverUrl}/api/reports/pdf-analyses/${body.report_id}/download-csv`
  );
  assert.equal(csvResponse.status, 200);
  const csv = (await csvResponse.text()).replace(/^\uFEFF/, '');
  assert.match(csv, /Review ID,Original review text,Predicted sentiment,Confidence score,Source PDF filename,Analysis date/);
  const parsedCsv = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  assert.equal(parsedCsv.data.length, body.chunks.length);
  body.chunks.forEach((review: { review_id: string; text: string; sentiment: string; confidence: number }, index: number) => {
    const row = parsedCsv.data[index];
    assert.equal(row['Review ID'], review.review_id);
    assert.equal(row['Original review text'], review.text);
    assert.equal(row['Predicted sentiment'], review.sentiment);
    assert.equal(row['Confidence score'], String(review.confidence));
    assert.equal(row['Source PDF filename'], 'Bank_Muscat_12_Reviews.pdf');
    assert.equal(row['Analysis date'], body.analyzed_at);
  });

  const originalResponse = await fetch(
    `${serverUrl}/api/reports/pdf-analyses/${body.report_id}/original`
  );
  assert.equal(originalResponse.status, 200);
  assert.deepEqual(Buffer.from(await originalResponse.arrayBuffer()), originalPdf);

  const combinedResponse = await fetch(
    `${serverUrl}/api/reports/pdf-analyses/${body.report_id}/download?includeOriginal=true`
  );
  assert.equal(combinedResponse.status, 200);
  const combined = Buffer.from(await combinedResponse.arrayBuffer());
  const parsedCombined = await extractPdfText(combined);
  assert.equal(parsedCombined.pageCount, parsedReport.pageCount + 3);
  assert.match(parsedCombined.text, /BM-TEST-012/);
});

test('splits long paragraphs into bounded, non-empty chunks without losing text', () => {
  const text = `${'A detailed customer review with useful information. '.repeat(60)}\n\nA second paragraph.`;
  const chunks = splitIntoChunks(text, 120);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.length <= 120));
  assert.ok(chunks.every(chunk => chunk.trim().length > 0));
  assert.ok(chunks.join(' ').includes('A second paragraph.'));
});

test('reports skipped review predictions explicitly instead of inventing results', async () => {
  const pdf = createTextPdf([
    'BM-TEST-001 | Service | Review one was analyzed successfully. BM-TEST-002 | Service | Review two cannot be analyzed.',
  ]);
  const result = await analyzePdf(pdf, text => {
    if (text.includes('BM-TEST-002')) throw new Error('test model failure');
    return {
      text,
      sentiment: 'Positive',
      confidence: 80,
      probabilities: { Positive: 80, Negative: 10, Neutral: 10 },
      explanation: 'Test prediction.',
      top_contributing_words: [],
      algorithm: 'Test model',
      model_accuracy: '100%',
    };
  });

  assert.equal(result.total_reviews, 2);
  assert.equal(result.successfully_analyzed_reviews, 1);
  assert.deepEqual(result.skipped_reviews, ['BM-TEST-002']);
  assert.deepEqual(result.analysis_errors, [
    'Sentiment prediction failed for review BM-TEST-002.',
  ]);
  assert.equal(result.chunks[0].review_id, 'BM-TEST-001');
  assert.equal(result.sentiment_distribution.Positive.count, 1);
  await assert.rejects(
    () => analyzePdf(pdf, () => { throw new Error('test model unavailable'); }),
    /could not analyze any review items/i
  );
});

test('records an unreadable page when the rest of the PDF can still be analyzed', async () => {
  const result = await analyzePdf(
    createTextPdf(['A readable customer review from this page.', '']),
    text => ({
      text,
      sentiment: 'Neutral',
      confidence: 60,
      probabilities: { Positive: 20, Negative: 20, Neutral: 60 },
      explanation: 'Test prediction.',
      top_contributing_words: [],
      algorithm: 'Test model',
      model_accuracy: '100%',
    })
  );
  assert.equal(result.page_count, 2);
  assert.equal(result.successfully_analyzed_reviews, 1);
  assert.deepEqual(result.extraction_errors, ['No readable text was extracted from page 2.']);
});

test('keeps extracted PDF model inputs within the configured chunk size', async () => {
  const review = 'The replacement card arrived earlier than expected. ';
  const { response, body } = await uploadPdf(createTextPdf([review.repeat(60)]));

  assert.equal(response.status, 200);
  assert.ok(body.chunks.length > 1);
  assert.ok(body.chunks.every((chunk: { text: string }) => chunk.text.length <= 1200));
});

test('rejects an empty text PDF with a clear message', async () => {
  const { response, body } = await uploadPdf(createTextPdf(['']));
  assert.equal(response.status, 422);
  assert.match(body.detail, /No readable text/i);
});

test('rejects a valid scanned/image-only PDF and explains that OCR is unsupported', async () => {
  const { response, body } = await uploadPdf(createImageOnlyPdf());
  assert.equal(response.status, 422);
  assert.match(body.detail, /scanned\/image-only/i);
});

test('rejects non-PDF content types and files without a PDF signature', async () => {
  const wrongMime = await uploadPdf(Buffer.from('not a PDF'), 'text/plain');
  assert.equal(wrongMime.response.status, 415);

  const invalidSignature = await uploadPdf(Buffer.from('not a PDF'));
  assert.equal(invalidSignature.response.status, 400);
});

test('rejects files that exceed the 10 MB limit', async () => {
  const oversized = await uploadPdf(Buffer.alloc(MAX_PDF_BYTES + 1));
  assert.equal(oversized.response.status, 413);
  assert.match(oversized.body.detail, /10 MB/i);

  assert.throws(
    () => validatePdfBuffer(Buffer.alloc(MAX_PDF_BYTES + 1)),
    (error: unknown) => error instanceof PdfUploadError && error.statusCode === 413
  );
});

test('reports corrupted and password-protected PDFs without exposing parser details', async () => {
  const corrupted = await uploadPdf(Buffer.from('%PDF-1.7\n%%EOF\n'));
  assert.equal(corrupted.response.status, 422);
  assert.match(corrupted.body.detail, /Unable to read this PDF/i);

  const passwordError = pdfProcessingError({ name: 'PasswordException', message: 'private parser detail' });
  assert.equal(passwordError.statusCode, 422);
  assert.match(passwordError.message, /Password-protected PDFs are not supported/i);
  assert.doesNotMatch(passwordError.message, /private parser detail/);
});

test('extracts all pages before chunking a multi-page document', async () => {
  const { text, pageCount } = await extractPdfText(createTextPdf(['First readable page.', 'Second readable page.']));
  assert.equal(pageCount, 2);
  assert.match(text, /First readable page/);
  assert.match(text, /Second readable page/);
});
