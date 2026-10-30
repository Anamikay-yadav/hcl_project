import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Search, Trash2 } from 'lucide-react';
import { fetchReviews, deleteReview } from '../api';
import { Review } from '../types';
import { CATEGORIES } from '../constants';
import { ReviewModal } from '../components/ReviewModal';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { PageHeader, SentimentBadge, formatDate } from '../components/ui';

export const ReviewsManagementPage: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const [sentiment, setSentiment] = useState('All');
  const [category, setCategory] = useState('All');
  const [rating, setRating] = useState(0);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selected, setSelected] = useState<Review | null>(null);
  const [toDelete, setToDelete] = useState<Review | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchReviews({ page, limit, search, sentiment, category, rating, sort_order: sortOrder });
      setReviews(data.reviews);
      setTotal(data.total);
      setTotalPages(Math.max(1, data.total_pages));
    } catch (err: any) {
      setError(err.message || 'Failed to load reviews.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, sentiment, category, rating, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      await deleteReview(toDelete.review_id);
      setToDelete(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete review.');
      setToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filter = (setter: (v: any) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div>
      <PageHeader title="Customer Reviews" subtitle={`${total.toLocaleString()} reviews`} />

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="col-span-2 md:col-span-2 relative">
            <Search className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
            <input
              type="search"
              aria-label="Search reviews"
              className="field h-9 pl-9"
              placeholder="Search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select aria-label="Sentiment" className="field h-9" value={sentiment} onChange={filter(setSentiment)}>
            <option value="All">All sentiments</option>
            <option>Positive</option>
            <option>Neutral</option>
            <option>Negative</option>
          </select>
          <select aria-label="Category" className="field h-9" value={category} onChange={filter(setCategory)}>
            <option value="All">All categories</option>
            {CATEGORIES.map(c => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Rating"
            className="field h-9"
            value={rating}
            onChange={e => {
              setRating(parseInt(e.target.value, 10));
              setPage(1);
            }}
          >
            <option value={0}>All ratings</option>
            {[5, 4, 3, 2, 1].map(r => (
              <option key={r} value={r}>
                {r} {r === 1 ? 'star' : 'stars'}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort order"
            className="field h-9"
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-neg mb-3" role="alert">{error}</p>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-head">ID</th>
                <th className="table-head">Date</th>
                <th className="table-head">Review</th>
                <th className="table-head">Category</th>
                <th className="table-head">Channel</th>
                <th className="table-head">Location</th>
                <th className="table-head">Rating</th>
                <th className="table-head">Sentiment</th>
                <th className="table-head text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className={isLoading ? 'opacity-50' : ''}>
              {!isLoading && reviews.length === 0 ? (
                <tr>
                  <td colSpan={9} className="table-cell text-center text-ink-muted py-12">
                    No reviews match the current filters.
                  </td>
                </tr>
              ) : (
                reviews.map(r => (
                  <tr key={r.review_id} className="hover:bg-blue-50/60">
                    <td className="table-cell whitespace-nowrap text-ink-muted tabular">{r.review_id}</td>
                    <td className="table-cell whitespace-nowrap text-ink-muted tabular">{formatDate(r.review_date)}</td>
                    <td className="table-cell min-w-72 max-w-md">{r.customer_review}</td>
                    <td className="table-cell whitespace-nowrap">{r.category}</td>
                    <td className="table-cell whitespace-nowrap text-ink-muted">{r.channel}</td>
                    <td className="table-cell whitespace-nowrap text-ink-muted">{r.location}</td>
                    <td className="table-cell whitespace-nowrap tabular">{r.rating}/5</td>
                    <td className="table-cell"><SentimentBadge sentiment={r.sentiment} /></td>
                    <td className="table-cell whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelected(r)}
                        title="View"
                        aria-label={`View ${r.review_id}`}
                        className="p-1.5 rounded text-ink-muted hover:text-navy-700 hover:bg-blue-100"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setToDelete(r)}
                        title="Delete"
                        aria-label={`Delete ${r.review_id}`}
                        className="p-1.5 rounded text-ink-muted hover:text-neg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 text-sm text-ink-muted">
          <span className="tabular">
            {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              Rows
              <select
                className="h-8 rounded-md border border-line bg-white px-2 text-sm text-ink"
                value={limit}
                onChange={e => {
                  setLimit(parseInt(e.target.value, 10));
                  setPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                className="btn-secondary h-8 px-2"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 tabular">
                {page} / {totalPages}
              </span>
              <button
                className="btn-secondary h-8 px-2"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ReviewModal review={selected} onClose={() => setSelected(null)} />
      <DeleteConfirmModal
        review={toDelete}
        isOpen={!!toDelete}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};
