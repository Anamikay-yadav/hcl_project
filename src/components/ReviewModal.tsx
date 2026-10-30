import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Review } from '../types';
import { SentimentBadge, formatDate } from './ui';

export const ReviewModal: React.FC<{ review: Review | null; onClose: () => void }> = ({ review, onClose }) => {
  useEffect(() => {
    if (!review) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [review, onClose]);

  if (!review) return null;

  const rows: [string, string][] = [
    ['Date', formatDate(review.review_date)],
    ['Category', review.category],
    ['Channel', review.channel],
    ['Location', review.location],
    ['Rating', `${review.rating} / 5`],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Review ${review.review_id}`}
    >
      <div className="card w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <h2 className="card-title tabular">{review.review_id}</h2>
            <SentimentBadge sentiment={review.sentiment} />
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-ink-muted hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <p className="text-base text-ink leading-relaxed">{review.customer_review}</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-ink-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
};
