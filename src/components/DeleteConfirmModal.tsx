import React from 'react';
import { Review } from '../types';

interface DeleteConfirmModalProps {
  review: Review | null;
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  review,
  isOpen,
  isDeleting,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !review) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/50"
      role="dialog"
      aria-modal="true"
      aria-label="Delete review"
    >
      <div className="card w-full max-w-sm p-5 shadow-xl">
        <h2 className="card-title">Delete review {review.review_id}?</h2>
        <p className="text-sm text-ink-muted mt-2 line-clamp-3">{review.customer_review}</p>
        <p className="text-sm text-ink-muted mt-3">This cannot be undone.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} disabled={isDeleting} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting} className="btn-danger">
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
