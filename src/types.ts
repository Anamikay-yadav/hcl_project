export type SentimentType = 'Positive' | 'Negative' | 'Neutral';

export interface Review {
  review_id: string;
  review_date: string;
  customer_review: string;
  sentiment: SentimentType;
  rating: number;
  category: string;
  channel: string;
  location: string;
  language: string;
  is_anomaly: boolean;
  imported_at?: string;
}

export interface User {
  username: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface DashboardStats {
  total_reviews: number;
  positive_reviews: number;
  negative_reviews: number;
  neutral_reviews: number;
  avg_rating: number;
  sentiment_distribution: Array<{ name: string; value: number; color: string }>;
  category_distribution: Array<{ name: string; count: number }>;
  channel_distribution: Array<{
    channel: string;
    total: number;
    Positive: number;
    Negative: number;
    Neutral: number;
  }>;
  recent_reviews: Review[];
}

export interface AnalysisResult {
  text: string;
  sentiment: SentimentType;
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

export interface PdfChunkResult extends AnalysisResult {
  chunk_index: number;
  review_id: string;
}

export interface SentimentDistributionEntry {
  count: number;
  percentage: number;
}

export interface PdfAnalysisReportSummary {
  report_id: string;
  filename: string;
  analyzed_at: string;
  page_count: number;
  total_reviews: number;
  successfully_analyzed_reviews: number;
  sentiment: SentimentType;
  confidence: number;
  sentiment_distribution: Record<string, SentimentDistributionEntry>;
  original_file_size: number;
  summary: string;
}

export interface PdfAnalysisResult extends AnalysisResult {
  extracted_text: string;
  page_count: number;
  total_reviews: number;
  successfully_analyzed_reviews: number;
  sentiment_distribution: Record<string, SentimentDistributionEntry>;
  report_id: string;
  filename: string;
  analyzed_at: string;
  original_file_size: number;
  summary: string;
  extraction_errors: string[];
  analysis_errors: string[];
  skipped_reviews: string[];
  chunks: PdfChunkResult[];
}

export interface CategoryReport {
  category: string;
  total: number;
  avg_rating: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface TimelineReport {
  month: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface ReportsData {
  total_reviews: number;
  sentiment_summary: {
    positive: { count: number; percentage: number };
    negative: { count: number; percentage: number };
    neutral: { count: number; percentage: number };
  };
  categories: CategoryReport[];
  timeline: TimelineReport[];
}
