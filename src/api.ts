import {
  AnalysisResult,
  DashboardStats,
  PdfAnalysisReportSummary,
  PdfAnalysisResult,
  ReportsData,
  Review,
  User,
} from './types';

const API_BASE = '';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('bm_auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function checkSystemHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function loginUser(credentials: { username: string; password: string }) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Login failed');
  return data;
}

export async function registerUser(details: {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  role?: string;
}) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Registration failed');
  return data;
}

export async function fetchCurrentUser(): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/api/dashboard/stats`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch dashboard stats' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function analyzeReview(payload: {
  review_text: string;
  save_to_db?: boolean;
  category?: string;
  channel?: string;
  location?: string;
}): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/sentiment/analyze`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Analysis failed');
  return data;
}

export async function analyzePdf(file: File): Promise<PdfAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/sentiment/analyze-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      'X-PDF-Filename': encodeURIComponent(file.name),
    },
    body: file,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'PDF analysis failed');
  return data;
}

export async function fetchReviews(params: {
  page?: number;
  limit?: number;
  search?: string;
  sentiment?: string;
  category?: string;
  rating?: number;
  sort_order?: 'asc' | 'desc';
}): Promise<{
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.search) query.set('search', params.search);
  if (params.sentiment) query.set('sentiment', params.sentiment);
  if (params.category) query.set('category', params.category);
  if (params.rating && params.rating > 0) query.set('rating', params.rating.toString());
  if (params.sort_order) query.set('sort_order', params.sort_order);

  const res = await fetch(`${API_BASE}/api/reviews?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch reviews');
  return res.json();
}

export async function fetchReviewDetails(reviewId: string): Promise<Review> {
  const res = await fetch(`${API_BASE}/api/reviews/${encodeURIComponent(reviewId)}`);
  if (!res.ok) throw new Error('Review not found');
  return res.json();
}

export async function deleteReview(reviewId: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/api/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Failed to delete review');
  return data;
}

export async function fetchReports(): Promise<ReportsData> {
  const res = await fetch(`${API_BASE}/api/reports`);
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}

export async function fetchPdfAnalysisReports(): Promise<PdfAnalysisReportSummary[]> {
  const res = await fetch(`${API_BASE}/api/reports/pdf-analyses`);
  if (!res.ok) throw new Error('Failed to fetch PDF analysis history.');
  return res.json();
}

async function fetchReportDownload(url: string, fallbackMessage: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: fallbackMessage }));
    throw new Error(data.detail || fallbackMessage);
  }
  return res.blob();
}

export function downloadPdfAnalysisReport(reportId: string, includeOriginal = false): Promise<Blob> {
  const query = includeOriginal ? '?includeOriginal=true' : '';
  return fetchReportDownload(
    `${API_BASE}/api/reports/pdf-analyses/${encodeURIComponent(reportId)}/download${query}`,
    'The PDF report could not be downloaded.'
  );
}

export function downloadOriginalPdf(reportId: string): Promise<Blob> {
  return fetchReportDownload(
    `${API_BASE}/api/reports/pdf-analyses/${encodeURIComponent(reportId)}/original`,
    'The original PDF could not be downloaded.'
  );
}

export function downloadPdfAnalysisCsv(reportId: string): Promise<Blob> {
  return fetchReportDownload(
    `${API_BASE}/api/reports/pdf-analyses/${encodeURIComponent(reportId)}/download-csv`,
    'The PDF analysis CSV could not be downloaded.'
  );
}
