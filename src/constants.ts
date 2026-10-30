import { SentimentType } from './types';

export const CATEGORIES = [
  'Accounts',
  'ATM Services',
  'Card Services',
  'Customer Support',
  'Fees and Charges',
  'Loans',
  'Mobile Banking',
  'Money Transfers',
];

export const CHANNELS = ['ATM', 'Branch', 'Call Centre', 'Email', 'Mobile App', 'Website'];

export const LOCATIONS = ['Barka', 'Muscat', 'Nizwa', 'Salalah', 'Seeb', 'Sohar', 'Sur', 'Oman'];

export const SENTIMENT_COLORS: Record<SentimentType, string> = {
  Positive: '#17855e',
  Neutral: '#7a8ca8',
  Negative: '#c0463c',
};

export const CHART_BLUE = '#245a9c';
export const CHART_GRID = '#e6ecf4';
export const CHART_AXIS = '#51627c';
