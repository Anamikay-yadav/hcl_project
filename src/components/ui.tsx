import React from 'react';
import { SENTIMENT_COLORS } from '../constants';
import { SentimentType } from '../types';

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
    <div>
      <h1 className="text-xl font-semibold text-navy-900">{title}</h1>
      {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);

export const SentimentBadge: React.FC<{ sentiment: SentimentType | string }> = ({ sentiment }) => (
  <span className="inline-flex items-center gap-1.5 text-sm text-ink whitespace-nowrap">
    <span
      className="w-2 h-2 rounded-full"
      style={{ background: SENTIMENT_COLORS[sentiment as SentimentType] || '#7a8ca8' }}
    />
    {sentiment}
  </span>
);

export const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3 text-ink-muted">
    <div className="w-7 h-7 border-2 border-navy-600 border-t-transparent rounded-full animate-spin" />
    {label && <p className="text-sm">{label}</p>}
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="card p-8 text-center max-w-md mx-auto mt-10">
    <p className="text-sm text-ink mb-1 font-medium">Unable to load data</p>
    <p className="text-sm text-ink-muted mb-4">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn-secondary">
        Try again
      </button>
    )}
  </div>
);

export const ChartTooltipStyle = {
  borderRadius: 6,
  border: '1px solid #dde4ee',
  boxShadow: 'none',
  fontSize: 12,
  color: '#14243b',
};

export const formatDate = (iso: string) => {
  const d = new Date(iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return iso.substring(0, 10);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatMonth = (ym: string) => {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (isNaN(d.getTime())) return ym;
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

export const AuthShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-canvas">
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <div className="text-xl font-semibold text-navy-900 tracking-tight">Bank Muscat</div>
        <div className="text-sm text-ink-muted">Sentiment Analytics</div>
      </div>
      <div className="card p-6 sm:p-7 border-t-2 border-t-navy-800">
        <h1 className="text-base font-semibold text-ink mb-5">{title}</h1>
        {children}
      </div>
    </div>
  </div>
);


export const SentimentLegend: React.FC = () => (
  <div className="flex items-center gap-4 text-xs text-ink-muted">
    {(['Positive', 'Neutral', 'Negative'] as SentimentType[]).map(s => (
      <span key={s} className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SENTIMENT_COLORS[s] }} />
        {s}
      </span>
    ))}
  </div>
);
