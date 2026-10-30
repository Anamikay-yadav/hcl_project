import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_CHUNK_CHARACTERS = 1200;

export interface PdfPrediction {
  text: string;
  sentiment: string;
  confidence: number;
  probabilities: Record<string, number>;
  explanation: string;
  top_contributing_words: Array<{
    word: string;
    impact: number;
    category: string;
  }>;
  algorithm: string;
  model_accuracy: string;
}

export interface PdfChunkResult extends PdfPrediction {
  chunk_index: number;
  review_id: string;
}

export interface SentimentDistributionEntry {
  count: number;
  percentage: number;
}

export interface PdfAnalysisResult {
  extracted_text: string;
  page_count: number;
  total_reviews: number;
  successfully_analyzed_reviews: number;
  sentiment_distribution: Record<string, SentimentDistributionEntry>;
  extraction_errors: string[];
  analysis_errors: string[];
  skipped_reviews: string[];
  sentiment: string;
  confidence: number;
  probabilities: Record<string, number>;
  explanation: string;
  top_contributing_words: PdfPrediction['top_contributing_words'];
  algorithm: string;
  model_accuracy: string;
  chunks: PdfChunkResult[];
}

export class PdfUploadError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'PdfUploadError';
  }
}

export function pdfProcessingError(error: unknown): PdfUploadError {
  if (error instanceof PdfUploadError) return error;
  if (error && typeof error === 'object' && 'name' in error && error.name === 'PasswordException') {
    return new PdfUploadError('Password-protected PDFs are not supported. Remove the password and try again.', 422);
  }
  return new PdfUploadError('Unable to read this PDF. Check that it is not corrupted or password-protected.', 422);
}

export function validatePdfBuffer(buffer: Buffer): void {
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new PdfUploadError('PDF files must be 10 MB or smaller.', 413);
  }

  const header = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
  if (!header.includes('%PDF-')) {
    throw new PdfUploadError('The uploaded file is not a valid PDF.', 400);
  }
}

export function splitIntoChunks(text: string, maxCharacters = MAX_CHUNK_CHARACTERS): string[] {
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current) chunks.push(current);
    current = '';
  };

  const addPiece = (piece: string) => {
    const trimmed = piece.trim();
    if (!trimmed) return;

    const combined = current ? `${current}\n\n${trimmed}` : trimmed;
    if (combined.length <= maxCharacters) {
      current = combined;
      return;
    }

    flush();
    if (trimmed.length <= maxCharacters) {
      current = trimmed;
      return;
    }

    let remaining = trimmed;
    while (remaining.length > maxCharacters) {
      let splitAt = remaining.lastIndexOf(' ', maxCharacters);
      if (splitAt < 1) splitAt = maxCharacters;
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    current = remaining;
  };

  const paragraphs = text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxCharacters) {
      addPiece(paragraph);
      flush();
      continue;
    }

    const sentences = paragraph.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [paragraph];
    for (const sentence of sentences) {
      if (sentence.trim().length <= maxCharacters) {
        addPiece(sentence);
        continue;
      }

      const words = sentence.trim().split(/\s+/);
      let wordGroup = '';
      for (const word of words) {
        if (word.length > maxCharacters) {
          addPiece(word);
          continue;
        }
        const combined = wordGroup ? `${wordGroup} ${word}` : word;
        if (combined.length > maxCharacters) {
          addPiece(wordGroup);
          wordGroup = word;
        } else {
          wordGroup = combined;
        }
      }
      addPiece(wordGroup);
    }
    flush();
  }

  return chunks;
}

function splitIntoReviews(text: string): Array<{ reviewId: string; text: string }> {
  const marker = /(?:^|\s)([A-Z][A-Z0-9_-]*\d{2,})\s*\|/g;
  const matches = Array.from(text.matchAll(marker), match => ({
    reviewId: match[1],
    start: match.index! + match[0].indexOf(match[1]),
  }));

  if (matches.length === 0) {
    return splitIntoChunks(text).map((chunk, index) => ({
      reviewId: `CHUNK-${String(index + 1).padStart(3, '0')}`,
      text: chunk,
    }));
  }

  return matches.flatMap((match, index) => {
    const end = matches[index + 1]?.start ?? text.length;
    return splitIntoChunks(text.slice(match.start, end)).map((chunk, chunkIndex) => ({
      reviewId: chunkIndex === 0
        ? match.reviewId
        : `${match.reviewId}-PART-${chunkIndex + 1}`,
      text: chunk,
    }));
  });
}

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number; pages: string[] }> {
  validatePdfBuffer(buffer);

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    stopAtErrors: true,
    useSystemFonts: true,
  });

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let line = '';

      for (const item of content.items) {
        if (!('str' in item)) continue;
        const value = item.str.trim();
        if (value) line = line ? `${line} ${value}` : value;
        if (item.hasEOL && line) {
          lines.push(line);
          line = '';
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join('\n'));
    }

    const text = pages.filter(Boolean).join('\n\n').trim();
    if (!text) {
      throw new PdfUploadError(
        'No readable text was found. This PDF may be empty or scanned/image-only; OCR is not supported.',
        422
      );
    }

    return { text, pageCount: document.numPages, pages };
  } catch (error) {
    throw pdfProcessingError(error);
  } finally {
    await loadingTask.destroy();
  }
}

export async function analyzePdf(
  buffer: Buffer,
  predict: (text: string) => PdfPrediction
): Promise<PdfAnalysisResult> {
  const { text, pageCount, pages } = await extractPdfText(buffer);
  const reviews = pages.flatMap(page => (page.trim() ? splitIntoReviews(page) : []));
  const chunks: PdfChunkResult[] = [];
  const skippedReviews: string[] = [];
  const analysisErrors: string[] = [];
  for (const review of reviews) {
    try {
      chunks.push({
        ...predict(review.text),
        review_id: review.reviewId,
        chunk_index: chunks.length + 1,
      });
    } catch {
      skippedReviews.push(review.reviewId);
      analysisErrors.push(`Sentiment prediction failed for review ${review.reviewId}.`);
    }
  }
  if (chunks.length === 0) {
    throw new PdfUploadError(
      'The PDF text was extracted, but the sentiment model could not analyze any review items. Please try again later.',
      422
    );
  }
  const totalCharacters = chunks.reduce((total, chunk) => total + chunk.text.length, 0);
  const probabilityTotals: Record<string, number> = {};
  const wordImpacts = new Map<string, { impact: number; category: string }>();

  for (const chunk of chunks) {
    const weight = chunk.text.length / totalCharacters;
    for (const [sentiment, probability] of Object.entries(chunk.probabilities)) {
      probabilityTotals[sentiment] = (probabilityTotals[sentiment] ?? 0) + probability * weight;
    }
    for (const word of chunk.top_contributing_words) {
      const existing = wordImpacts.get(word.word);
      wordImpacts.set(word.word, {
        impact: (existing?.impact ?? 0) + word.impact * weight,
        category: word.category,
      });
    }
  }

  const probabilities = Object.fromEntries(
    Object.entries(probabilityTotals).map(([sentiment, probability]) => [
      sentiment,
      Math.round(probability * 10) / 10,
    ])
  );
  const sentiment = Object.entries(probabilities).reduce(
    (best, [candidate, probability]) => (probability > best.probability ? { candidate, probability } : best),
    { candidate: chunks[0].sentiment, probability: -1 }
  ).candidate;
  const sentimentCounts = chunks.reduce<Record<string, number>>((counts, chunk) => {
    counts[chunk.sentiment] = (counts[chunk.sentiment] ?? 0) + 1;
    return counts;
  }, {});
  const sentimentDistribution = Object.fromEntries(
    ['Positive', 'Negative', 'Neutral'].map(label => [
      label,
      {
        count: sentimentCounts[label] ?? 0,
        percentage: Math.round(((sentimentCounts[label] ?? 0) / chunks.length) * 1000) / 10,
      },
    ])
  );
  const firstChunk = chunks[0];
  const topContributingWords = Array.from(wordImpacts, ([word, value]) => ({
    word,
    impact: Math.round(value.impact * 1000) / 1000,
    category: value.category,
  }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 6);

  return {
    extracted_text: text,
    page_count: pageCount,
    total_reviews: reviews.length,
    successfully_analyzed_reviews: chunks.length,
    sentiment_distribution: sentimentDistribution,
    extraction_errors: pages.flatMap((page, index) =>
      page.trim() ? [] : [`No readable text was extracted from page ${index + 1}.`]
    ),
    analysis_errors: analysisErrors,
    skipped_reviews: skippedReviews,
    sentiment,
    confidence: probabilities[sentiment] ?? firstChunk.confidence,
    probabilities,
    explanation: `Overall ${sentiment} sentiment from ${chunks.length} text chunk${chunks.length === 1 ? '' : 's'} analyzed with the existing model.`,
    top_contributing_words: topContributingWords,
    algorithm: firstChunk.algorithm,
    model_accuracy: firstChunk.model_accuracy,
    chunks,
  };
}
