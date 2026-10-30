import React, { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  downloadOriginalPdf,
  downloadPdfAnalysisCsv,
  downloadPdfAnalysisReport,
  fetchPdfAnalysisReports,
  fetchReports,
} from '../api';
import { PdfAnalysisReportSummary, ReportsData } from '../types';
import { CHART_AXIS, CHART_GRID, SENTIMENT_COLORS } from '../constants';
import {
  ChartTooltipStyle,
  ErrorState,
  PageHeader,
  SentimentBadge,
  SentimentLegend,
  Spinner,
  formatMonth,
} from '../components/ui';
const axisTick = { fontSize: 12, fill: CHART_AXIS };
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<ReportsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfReports, setPdfReports] = useState<PdfAnalysisReportSummary[]>([]);
  const [pdfReportsError, setPdfReportsError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingAction, setDownloadingAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchReports());
    } catch (err: any) {
      setError(err.message || 'Failed to load reports.');
      return;
    }

    try {
      setPdfReports(await fetchPdfAnalysisReports());
      setPdfReportsError(null);
    } catch (err) {
      setPdfReportsError(err instanceof Error ? err.message : 'Failed to load PDF analysis history.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch('/api/reports/download-csv');
      if (!res.ok) throw new Error('Export failed');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `bank_muscat_reviews_${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('The export could not be completed. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePdfReportDownload = async (
    report: PdfAnalysisReportSummary,
    action: 'report' | 'combined' | 'original' | 'csv'
  ) => {
    const key = `${report.report_id}:${action}`;
    setDownloadingAction(key);
    setDownloadError(null);
    const baseName = report.filename.replace(/\.pdf$/i, '');
    try {
      if (action === 'report') {
        saveBlob(await downloadPdfAnalysisReport(report.report_id), `${baseName}_complete_analysis_report.pdf`);
      } else if (action === 'combined') {
        saveBlob(
          await downloadPdfAnalysisReport(report.report_id, true),
          `${baseName}_complete_analysis_with_original.pdf`
        );
      } else if (action === 'original') {
        saveBlob(await downloadOriginalPdf(report.report_id), report.filename);
      } else {
        saveBlob(await downloadPdfAnalysisCsv(report.report_id), `${baseName}_analysis.csv`);
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'The requested report download failed.');
    } finally {
      setDownloadingAction(null);
    }
  };

  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Spinner />;

  const summary = data.sentiment_summary;
  const tiles = summary
    ? [
        { label: 'Total reviews', value: data.total_reviews.toLocaleString(), note: '' },
        { label: 'Positive', value: summary.positive.count.toLocaleString(), note: `${summary.positive.percentage}%` },
        { label: 'Neutral', value: summary.neutral.count.toLocaleString(), note: `${summary.neutral.percentage}%` },
        { label: 'Negative', value: summary.negative.count.toLocaleString(), note: `${summary.negative.percentage}%` },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Sentiment trends and service category performance"
        actions={
          <button onClick={handleExport} disabled={isDownloading} className="btn-secondary">
            <Download className="w-4 h-4" />
            {isDownloading ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      {error && <p className="text-sm text-neg mb-3" role="alert">{error}</p>}
      {downloadError && <p className="text-sm text-neg mb-3" role="alert">{downloadError}</p>}

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden">
          {tiles.map(t => (
            <div key={t.label} className="p-5 bg-white">
              <p className="text-xs font-medium text-ink-muted">{t.label}</p>
              <p className="text-xl font-semibold text-navy-900 mt-1 tabular">
                {t.value}
                {t.note && <span className="text-sm font-normal text-ink-muted ml-2">{t.note}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="card mt-4 overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="card-title">Previous Analysis Reports</h2>
          <p className="text-xs text-ink-muted mt-1">PDF analyses saved with their original documents and review-level results.</p>
        </div>
        {pdfReportsError ? (
          <p className="px-5 pb-4 text-sm text-neg" role="alert">{pdfReportsError}</p>
        ) : pdfReports.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink-muted">No PDF analysis reports are available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-head">Uploaded document</th>
                  <th className="table-head">Analysis date</th>
                  <th className="table-head text-right">Reviews analyzed</th>
                  <th className="table-head">Overall sentiment</th>
                  <th className="table-head min-w-72">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {pdfReports.map(report => (
                  <tr key={report.report_id}>
                    <td className="table-cell max-w-56">
                      <p className="font-medium break-words">{report.filename}</p>
                      <p className="text-xs text-ink-faint">{report.page_count} pages</p>
                    </td>
                    <td className="table-cell whitespace-nowrap">{new Date(report.analyzed_at).toLocaleString()}</td>
                    <td className="table-cell text-right tabular">
                      {report.successfully_analyzed_reviews} / {report.total_reviews}
                    </td>
                    <td className="table-cell whitespace-nowrap">
                      <SentimentBadge sentiment={report.sentiment} />
                      <span className="ml-2 text-xs text-ink-muted">{report.confidence}%</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className="btn-secondary h-8 px-2 text-xs"
                          onClick={() => void handlePdfReportDownload(report, 'report')}
                          disabled={downloadingAction !== null}
                        >
                          {downloadingAction === `${report.report_id}:report` ? 'Preparing…' : 'Download Report'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary h-8 px-2 text-xs"
                          onClick={() => void handlePdfReportDownload(report, 'csv')}
                          disabled={downloadingAction !== null}
                        >
                          CSV
                        </button>
                        <button
                          type="button"
                          className="btn-secondary h-8 px-2 text-xs"
                          onClick={() => void handlePdfReportDownload(report, 'original')}
                          disabled={downloadingAction !== null}
                        >
                          Original PDF
                        </button>
                        <button
                          type="button"
                          className="btn-secondary h-8 px-2 text-xs"
                          onClick={() => void handlePdfReportDownload(report, 'combined')}
                          disabled={downloadingAction !== null}
                        >
                          Report + original
                        </button>
                      </div>
                      <p className="text-xs text-ink-faint mt-1">{report.summary}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-5 mt-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <h2 className="card-title">Reviews per month</h2>
          <SentimentLegend />
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.timeline} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={CHART_GRID} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: CHART_GRID }}
                minTickGap={28}
              />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={ChartTooltipStyle} labelFormatter={l => formatMonth(String(l))} />
              <Area type="monotone" dataKey="positive" name="Positive" stackId="1" stroke={SENTIMENT_COLORS.Positive} fill={SENTIMENT_COLORS.Positive} fillOpacity={0.85} strokeWidth={1.5} />
              <Area type="monotone" dataKey="neutral" name="Neutral" stackId="1" stroke={SENTIMENT_COLORS.Neutral} fill={SENTIMENT_COLORS.Neutral} fillOpacity={0.85} strokeWidth={1.5} />
              <Area type="monotone" dataKey="negative" name="Negative" stackId="1" stroke={SENTIMENT_COLORS.Negative} fill={SENTIMENT_COLORS.Negative} fillOpacity={0.85} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card mt-4 overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="card-title">Category performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-head">Category</th>
                <th className="table-head text-right">Reviews</th>
                <th className="table-head text-right">Positive</th>
                <th className="table-head text-right">Neutral</th>
                <th className="table-head text-right">Negative</th>
                <th className="table-head text-right">Avg. rating</th>
                <th className="table-head min-w-40">Sentiment mix</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map(c => (
                <tr key={c.category}>
                  <td className="table-cell font-medium whitespace-nowrap">{c.category}</td>
                  <td className="table-cell text-right tabular">{c.total.toLocaleString()}</td>
                  <td className="table-cell text-right tabular">{pct(c.positive, c.total)}%</td>
                  <td className="table-cell text-right tabular">{pct(c.neutral, c.total)}%</td>
                  <td className="table-cell text-right tabular">{pct(c.negative, c.total)}%</td>
                  <td className="table-cell text-right tabular">{c.avg_rating.toFixed(2)}</td>
                  <td className="table-cell">
                    <div className="flex h-2 gap-0.5" title={`${c.positive} positive, ${c.neutral} neutral, ${c.negative} negative`}>
                      <div className="rounded-sm" style={{ flex: c.positive, background: SENTIMENT_COLORS.Positive }} />
                      <div className="rounded-sm" style={{ flex: c.neutral, background: SENTIMENT_COLORS.Neutral }} />
                      <div className="rounded-sm" style={{ flex: c.negative, background: SENTIMENT_COLORS.Negative }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
