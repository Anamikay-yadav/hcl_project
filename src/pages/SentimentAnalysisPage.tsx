import React, { useRef, useState } from 'react';
import { Download, FileText, Upload, X } from 'lucide-react';
import { analyzePdf, analyzeReview, downloadOriginalPdf, downloadPdfAnalysisReport } from '../api';
import { AnalysisResult, PdfAnalysisResult } from '../types';
import { CATEGORIES, CHANNELS, LOCATIONS, SENTIMENT_COLORS } from '../constants';
import { PageHeader, SentimentBadge } from '../components/ui';

const MAX_PDF_SIZE = 10 * 1024 * 1024;
const PDF_CHUNKS_PER_PAGE = 10;

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SentimentAnalysisPage: React.FC = () => {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Customer Support');
  const [channel, setChannel] = useState('Mobile App');
  const [location, setLocation] = useState('Muscat');
  const [save, setSave] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'pdf'>('text');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [pdfResult, setPdfResult] = useState<PdfAnalysisResult | null>(null);
  const [pdfChunkPage, setPdfChunkPage] = useState(0);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Enter a review to analyze.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSaved(false);
    try {
      const data = await analyzeReview({ review_text: text.trim(), save_to_db: save, category, channel, location });
      setResult(data);
      setSaved(save);
    } catch (err: any) {
      setError(err.message || 'Analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectPdf = async (file?: File) => {
    setError(null);
    setPdfResult(null);
    if (!file) return;

    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      setPdfFile(null);
      setError('Choose a PDF file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setPdfFile(null);
      setError('PDF files must be 10 MB or smaller.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    let header: Uint8Array;
    try {
      header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    } catch {
      setPdfFile(null);
      setError('Unable to read the selected file. Please choose another PDF.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const signature = new TextDecoder().decode(header);
    if (!signature.includes('%PDF-')) {
      setPdfFile(null);
      setError('This file does not have a valid PDF signature.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPdfFile(file);
    setSaved(false);
  };

  const clearPdf = () => {
    setPdfFile(null);
    setPdfResult(null);
    setError(null);
    setPdfChunkPage(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyzePdf = async () => {
    if (!pdfFile) {
      setError('Choose a PDF file to analyze.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setPdfResult(null);
    try {
      const data = await analyzePdf(pdfFile);
      setPdfResult(data);
      setPdfChunkPage(0);
    } catch (err: any) {
      setError(err.message || 'PDF analysis failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePdfDownload = async (includeOriginal: boolean) => {
    if (!pdfResult) return;
    setIsDownloadingReport(true);
    setError(null);
    try {
      const report = await downloadPdfAnalysisReport(pdfResult.report_id, includeOriginal);
      const base = pdfFile?.name.replace(/\.pdf$/i, '') || 'analysis';
      downloadBlob(
        report,
        includeOriginal ? `${base}_complete_analysis_with_original.pdf` : `${base}_complete_analysis_report.pdf`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The PDF report could not be downloaded.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const handleOriginalDownload = async () => {
    if (!pdfResult) return;
    setIsDownloadingReport(true);
    setError(null);
    try {
      downloadBlob(await downloadOriginalPdf(pdfResult.report_id), pdfResult.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The original PDF could not be downloaded.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const select = (value: string, set: (v: string) => void, options: string[], id: string, label: string) => (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="field h-9" value={value} onChange={e => set(e.target.value)}>
        {options.map(o => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  const renderProbabilities = (probabilities: Record<string, number>) => (
    <div className="space-y-2.5">
      {['Positive', 'Neutral', 'Negative'].map(sentiment => {
        const probability = probabilities[sentiment] ?? 0;
        return (
          <div key={sentiment}>
            <div className="flex justify-between text-sm mb-1">
              <SentimentBadge sentiment={sentiment} />
              <span className="text-ink-muted tabular">{probability}%</span>
            </div>
            <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${probability}%`,
                  background: SENTIMENT_COLORS[sentiment as keyof typeof SENTIMENT_COLORS],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  const chunkPageCount = pdfResult ? Math.ceil(pdfResult.chunks.length / PDF_CHUNKS_PER_PAGE) : 0;
  const visibleChunks = pdfResult?.chunks.slice(
    pdfChunkPage * PDF_CHUNKS_PER_PAGE,
    (pdfChunkPage + 1) * PDF_CHUNKS_PER_PAGE
  ) ?? [];

  return (
    <div>
      <PageHeader title="Sentiment Analysis" subtitle="Classify a customer review or a text-based PDF with the existing sentiment model." />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <section className="card p-5 lg:col-span-3 space-y-4">
          <div role="tablist" aria-label="Analysis input" className="flex gap-2 border-b border-line">
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'text'}
              onClick={() => {
                setInputMode('text');
                setError(null);
              }}
              className={`px-3 py-2 text-sm border-b-2 ${
                inputMode === 'text' ? 'border-navy-700 text-navy-800 font-medium' : 'border-transparent text-ink-muted'
              }`}
            >
              Enter Review Text
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === 'pdf'}
              onClick={() => {
                setInputMode('pdf');
                setError(null);
              }}
              className={`px-3 py-2 text-sm border-b-2 ${
                inputMode === 'pdf' ? 'border-navy-700 text-navy-800 font-medium' : 'border-transparent text-ink-muted'
              }`}
            >
              Upload PDF
            </button>
          </div>

          {inputMode === 'text' ? (
            <form onSubmit={handleAnalyze} className="space-y-4">
              <div>
                <label htmlFor="review" className="label">Customer review</label>
                <textarea
                  id="review"
                  rows={6}
                  className="field py-2 resize-y"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Enter review text"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {select(category, setCategory, CATEGORIES, 'category', 'Category')}
                {select(channel, setChannel, CHANNELS, 'channel', 'Channel')}
                {select(location, setLocation, LOCATIONS, 'location', 'Location')}
              </div>

              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={save}
                  onChange={e => setSave(e.target.checked)}
                  className="w-4 h-4 accent-navy-800"
                />
                Add to customer reviews
              </label>

              {error && <p className="text-sm text-neg" role="alert">{error}</p>}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={isLoading} className="btn-primary">
                  {isLoading ? 'Analyzing…' : 'Analyze'}
                </button>
                {text && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setText('');
                      setResult(null);
                      setError(null);
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                aria-label="Select a PDF file"
                onChange={e => void selectPdf(e.target.files?.[0])}
              />

              <div
                onDragEnter={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={e => {
                  e.preventDefault();
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragging(false);
                }}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  void selectPdf(e.dataTransfer.files[0]);
                }}
                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging ? 'border-navy-600 bg-blue-50' : 'border-line bg-blue-50/40'
                }`}
              >
                <Upload className="w-6 h-6 mx-auto mb-2 text-navy-700" aria-hidden="true" />
                <p className="text-sm font-medium text-ink">Drag and drop a PDF here</p>
                <p className="text-xs text-ink-muted mt-1">Text-based PDFs up to 10 MB</p>
                <button
                  type="button"
                  className="btn-secondary mt-3"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  Choose PDF
                </button>
              </div>

              {pdfFile && (
                <div className="flex items-center gap-3 rounded-md border border-line px-3 py-2">
                  <FileText className="w-5 h-5 shrink-0 text-navy-700" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{pdfFile.name}</p>
                    <p className="text-xs text-ink-muted">{formatFileSize(pdfFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary h-8 px-2"
                    onClick={clearPdf}
                    disabled={isLoading}
                    aria-label="Remove PDF"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-neg" role="alert">{error}</p>}

              <button
                type="button"
                className="btn-primary"
                onClick={handleAnalyzePdf}
                disabled={!pdfFile || isLoading}
              >
                {isLoading ? 'Analyzing PDF…' : 'Analyze PDF'}
              </button>
              <p className="text-xs text-ink-faint">PDF text is extracted by this application and is not stored as a file.</p>
            </div>
          )}
        </section>

        <section className="card p-5 lg:col-span-2 min-h-64">
          {inputMode === 'pdf' && pdfResult ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-ink-muted">Overall PDF result · {pdfResult.page_count} page{pdfResult.page_count === 1 ? '' : 's'}</p>
                <div className="mt-1.5 flex items-baseline gap-3">
                  <span className="text-2xl font-semibold text-navy-900">{pdfResult.sentiment}</span>
                  <span className="text-sm text-ink-muted tabular">{pdfResult.confidence}% confidence</span>
                </div>
                <p className="text-xs text-ink-muted mt-1">
                  {pdfResult.successfully_analyzed_reviews} of {pdfResult.total_reviews} extracted reviews analyzed
                </p>
                <p className="text-xs text-ink-faint mt-1">
                  Saved to Previous Analysis Reports · {new Date(pdfResult.analyzed_at).toLocaleString()}
                </p>
              </div>

              {renderProbabilities(pdfResult.probabilities)}

              {(pdfResult.extraction_errors.length > 0 ||
                pdfResult.analysis_errors.length > 0 ||
                pdfResult.skipped_reviews.length > 0) && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="status">
                  <p className="font-medium">Analysis completed with issues.</p>
                  <p>{pdfResult.summary}</p>
                  {[...pdfResult.extraction_errors, ...pdfResult.analysis_errors].map((issue, index) => (
                    <p key={`issue-${index}`} className="mt-1">{issue}</p>
                  ))}
                  {pdfResult.skipped_reviews.length > 0 && (
                    <p className="mt-1">Skipped review IDs: {pdfResult.skipped_reviews.join(', ')}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handlePdfDownload(false)}
                  disabled={isDownloadingReport}
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  {isDownloadingReport ? 'Preparing report…' : 'Download Complete Analysis Report (PDF)'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void handlePdfDownload(true)}
                  disabled={isDownloadingReport}
                >
                  Download report + original PDF
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void handleOriginalDownload()}
                  disabled={isDownloadingReport}
                >
                  Download original PDF
                </button>
              </div>

              <details open className="border-t border-line pt-3">
                <summary className="cursor-pointer text-xs font-medium text-ink-muted">
                  Extracted text preview
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-blue-50 p-3 text-xs text-ink">
                  {pdfResult.extracted_text}
                </pre>
              </details>

              <div className="border-t border-line pt-3">
                <p className="text-xs font-medium text-ink-muted mb-2">Individual review results</p>
                <div className="space-y-2 max-h-96 overflow-auto">
                  {visibleChunks.map(chunk => (
                    <details key={chunk.review_id} className="rounded border border-line p-3">
                      <summary className="cursor-pointer text-sm">
                        <span className="font-medium">Review {chunk.review_id} · {chunk.sentiment}</span>
                        <span className="text-ink-muted"> · {chunk.confidence}% confidence</span>
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs text-ink-muted">{chunk.text}</p>
                      <div className="mt-3">{renderProbabilities(chunk.probabilities)}</div>
                    </details>
                  ))}
                </div>
                {chunkPageCount > 1 && (
                  <div className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                    <button
                      type="button"
                      className="btn-secondary h-8 px-2"
                      onClick={() => setPdfChunkPage(page => Math.max(0, page - 1))}
                      disabled={pdfChunkPage === 0}
                    >
                      Previous
                    </button>
                    <span>Page {pdfChunkPage + 1} of {chunkPageCount}</span>
                    <button
                      type="button"
                      className="btn-secondary h-8 px-2"
                      onClick={() => setPdfChunkPage(page => Math.min(chunkPageCount - 1, page + 1))}
                      disabled={pdfChunkPage + 1 >= chunkPageCount}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-ink-faint pt-3 border-t border-line">
                {pdfResult.algorithm} · {pdfResult.model_accuracy} training accuracy
              </p>
            </div>
          ) : inputMode === 'text' && result ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-ink-muted">Result</p>
                <div className="mt-1.5 flex items-baseline gap-3">
                  <span className="text-2xl font-semibold text-navy-900">{result.sentiment}</span>
                  <span className="text-sm text-ink-muted tabular">{result.confidence}% confidence</span>
                </div>
                {saved && <p className="text-xs text-ink-muted mt-1">Added to customer reviews.</p>}
              </div>

              {renderProbabilities(result.probabilities)}

              {result.top_contributing_words.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-ink-muted mb-2">Key terms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.top_contributing_words.map(word => (
                      <span
                        key={word.word}
                        className={`px-2 py-0.5 rounded text-xs border ${
                          word.impact > 0
                            ? 'bg-blue-100 border-blue-200 text-navy-800'
                            : 'bg-white border-line text-ink-muted'
                        }`}
                      >
                        {word.word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-ink-faint pt-3 border-t border-line">
                {result.algorithm} · {result.model_accuracy} training accuracy
              </p>
            </div>
          ) : (
            <div className="h-full min-h-52 flex items-center justify-center text-sm text-ink-faint">
              Results will appear here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
