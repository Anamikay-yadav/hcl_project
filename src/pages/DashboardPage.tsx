import React, { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DashboardStats, ReportsData } from '../types';
import { fetchDashboardStats, fetchReports } from '../api';
import { CHART_AXIS, CHART_BLUE, CHART_GRID, SENTIMENT_COLORS } from '../constants';
import {
  ChartTooltipStyle,
  ErrorState,
  PageHeader,
  SentimentBadge,
  SentimentLegend,
  Spinner,
  formatDate,
  formatMonth,
} from '../components/ui';

const pct = (part: number, total: number) => (total ? ((part / total) * 100).toFixed(1) : '0.0');
const axisTick = { fontSize: 12, fill: CHART_AXIS };

const Kpi: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="card p-5">
    <p className="text-xs font-medium text-ink-muted">{label}</p>
    <p className="text-2xl font-semibold text-navy-900 mt-1.5 tabular">{value}</p>
    <p className="text-xs text-ink-faint mt-1 tabular">{note}</p>
  </div>
);

export const DashboardPage: React.FC<{ onViewReviews: () => void }> = ({ onViewReviews }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, r] = await Promise.all([fetchDashboardStats(), fetchReports()]);
      setStats(s);
      setReports(r);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats || !reports) return <Spinner />;

  const total = stats.total_reviews;
  const timeline = reports.timeline || [];
  const period =
    timeline.length > 0
      ? `${formatMonth(timeline[0].month)} – ${formatMonth(timeline[timeline.length - 1].month)}`
      : '';
  const donut = ['Positive', 'Neutral', 'Negative'].map(name => ({
    name,
    value:
      name === 'Positive' ? stats.positive_reviews : name === 'Neutral' ? stats.neutral_reviews : stats.negative_reviews,
  }));
  const categories = [...stats.category_distribution].sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={period ? `Customer feedback, ${period}` : undefined} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Total reviews" value={total.toLocaleString()} note={`${categories.length} service categories`} />
        <Kpi
          label="Positive"
          value={`${pct(stats.positive_reviews, total)}%`}
          note={`${stats.positive_reviews.toLocaleString()} reviews`}
        />
        <Kpi
          label="Negative"
          value={`${pct(stats.negative_reviews, total)}%`}
          note={`${stats.negative_reviews.toLocaleString()} reviews`}
        />
        <Kpi label="Average rating" value={`${stats.avg_rating.toFixed(2)} / 5`} note="All reviews" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h2 className="card-title">Monthly sentiment</h2>
            <SentimentLegend />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
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
                <Line type="monotone" dataKey="positive" name="Positive" stroke={SENTIMENT_COLORS.Positive} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="neutral" name="Neutral" stroke={SENTIMENT_COLORS.Neutral} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="negative" name="Negative" stroke={SENTIMENT_COLORS.Negative} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="card-title mb-4">Sentiment mix</h2>
          <div className="h-44 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donut}
                  dataKey="value"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {donut.map(d => (
                    <Cell key={d.name} fill={SENTIMENT_COLORS[d.name as keyof typeof SENTIMENT_COLORS]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={ChartTooltipStyle} formatter={(v: any) => [Number(v).toLocaleString(), 'Reviews']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-semibold text-navy-900 tabular">{total.toLocaleString()}</span>
              <span className="text-xs text-ink-faint">reviews</span>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {donut.map(d => (
              <li key={d.name} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-ink">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SENTIMENT_COLORS[d.name as keyof typeof SENTIMENT_COLORS] }} />
                  {d.name}
                </span>
                <span className="text-ink-muted tabular">
                  {d.value.toLocaleString()} · {pct(d.value, total)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <section className="card p-5">
          <h2 className="card-title mb-4">Reviews by category</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={ChartTooltipStyle} cursor={{ fill: '#f1f6fc' }} formatter={(v: any) => [Number(v).toLocaleString(), 'Reviews']} />
                <Bar dataKey="count" name="Reviews" fill={CHART_BLUE} radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h2 className="card-title">Sentiment by channel</h2>
            <SentimentLegend />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.channel_distribution} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} horizontal={false} />
                <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="channel" width={90} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={ChartTooltipStyle} cursor={{ fill: '#f1f6fc' }} />
                <Bar dataKey="Positive" stackId="s" fill={SENTIMENT_COLORS.Positive} stroke="#fff" strokeWidth={2} barSize={16} />
                <Bar dataKey="Neutral" stackId="s" fill={SENTIMENT_COLORS.Neutral} stroke="#fff" strokeWidth={2} barSize={16} />
                <Bar dataKey="Negative" stackId="s" fill={SENTIMENT_COLORS.Negative} stroke="#fff" strokeWidth={2} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="card-title">Recent reviews</h2>
          <button onClick={onViewReviews} className="text-sm font-medium text-navy-600 hover:underline">
            View all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="table-head">Date</th>
                <th className="table-head">Review</th>
                <th className="table-head">Category</th>
                <th className="table-head">Channel</th>
                <th className="table-head">Rating</th>
                <th className="table-head">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent_reviews.map(r => (
                <tr key={r.review_id}>
                  <td className="table-cell whitespace-nowrap text-ink-muted tabular">{formatDate(r.review_date)}</td>
                  <td className="table-cell min-w-72 max-w-md">{r.customer_review}</td>
                  <td className="table-cell whitespace-nowrap">{r.category}</td>
                  <td className="table-cell whitespace-nowrap text-ink-muted">{r.channel}</td>
                  <td className="table-cell whitespace-nowrap tabular">{r.rating}/5</td>
                  <td className="table-cell"><SentimentBadge sentiment={r.sentiment} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
