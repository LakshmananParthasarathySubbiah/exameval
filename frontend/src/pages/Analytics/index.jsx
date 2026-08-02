import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { examsApi, analyticsApi } from '../../api/resources';

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-surface-800 bg-surface-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const fmt = (n, d = 2) => (n == null ? '—' : Number(n).toFixed(d));

// Color difficulty: red = hard (low), green = easy (high).
const difficultyColor = (d) => (d < 0.4 ? '#ef4444' : d < 0.7 ? '#f59e0b' : '#22c55e');

export default function AnalyticsPage() {
  const [examId, setExamId] = useState('');

  const { data: examsRes } = useQuery({
    queryKey: ['exams', 'all'],
    queryFn: () => examsApi.list({ limit: 100 }).then((r) => r.data),
  });
  const exams = examsRes?.data || [];

  const {
    data: analyticsRes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['analytics', examId],
    queryFn: () => analyticsApi.exam(examId).then((r) => r.data),
    enabled: !!examId,
  });

  const analytics = analyticsRes?.data;

  const distData = useMemo(
    () => (analytics?.scoreDistribution || []).map((b) => ({ name: b.range, count: b.count })),
    [analytics]
  );
  const itemData = analytics?.itemAnalysis || [];

  return (
    <div className="space-y-6">
      {/* Exam selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-400">Exam</label>
        <select
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
          className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
        >
          <option value="">Select an exam…</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.title}
            </option>
          ))}
        </select>
      </div>

      {!examId && (
        <div className="rounded-xl border border-dashed border-surface-700 p-10 text-center text-slate-500">
          Pick an exam to see its analytics.
        </div>
      )}

      {examId && isLoading && <div className="text-slate-400">Loading analytics…</div>}
      {examId && isError && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">
          Failed to load analytics: {error?.response?.data?.error || error?.message}
        </div>
      )}

      {analytics && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Evaluations" value={analytics.summary.totalEvaluations} />
            <StatCard label="Avg score" value={`${fmt(analytics.summary.averagePercentage)}%`} />
            <StatCard
              label="Pending review"
              value={analytics.summary.pendingReview}
              hint="low-confidence"
            />
            <StatCard label="Overrides" value={analytics.summary.overrides} />
            <StatCard
              label="Reliability α"
              value={fmt(analytics.summary.reliabilityCronbachAlpha)}
              hint="Cronbach"
            />
            <StatCard
              label="Injection flags"
              value={analytics.summary.injectionFlaggedQuestions}
              hint="suspect answers"
            />
          </div>

          {/* Score distribution */}
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Score distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Question difficulty */}
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5">
            <h3 className="mb-1 text-sm font-semibold text-white">Question difficulty</h3>
            <p className="mb-4 text-xs text-slate-500">
              Proportion correct (0 = hard, 1 = easy). Green = easy, red = hard.
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={itemData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="questionNumber" stroke="#64748b" fontSize={12} />
                <YAxis domain={[0, 1]} stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', color: '#fff' }}
                />
                <Bar dataKey="difficulty" radius={[4, 4, 0, 0]}>
                  {itemData.map((d) => (
                    <Cell key={d.questionNumber} fill={difficultyColor(d.difficulty)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Item analysis table */}
          <div className="rounded-xl border border-surface-800 bg-surface-900 p-5">
            <h3 className="mb-1 text-sm font-semibold text-white">Item analysis</h3>
            <p className="mb-4 text-xs text-slate-500">
              Discrimination = how well a question separates strong vs weak students (&gt;0.3 good,
              &lt;0.1 poor — consider revising).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-800 text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">Question</th>
                    <th className="py-2 pr-4">n</th>
                    <th className="py-2 pr-4">Mean</th>
                    <th className="py-2 pr-4">Max</th>
                    <th className="py-2 pr-4">Difficulty</th>
                    <th className="py-2 pr-4">Discrimination</th>
                  </tr>
                </thead>
                <tbody>
                  {itemData.map((q) => (
                    <tr key={q.questionNumber} className="border-b border-surface-800/60 text-slate-300">
                      <td className="py-2 pr-4 font-mono text-white">{q.questionNumber}</td>
                      <td className="py-2 pr-4">{q.n}</td>
                      <td className="py-2 pr-4">{fmt(q.meanScore)}</td>
                      <td className="py-2 pr-4">{q.maxScore}</td>
                      <td className="py-2 pr-4">{fmt(q.difficulty)}</td>
                      <td
                        className={`py-2 pr-4 font-medium ${
                          q.discrimination < 0.1
                            ? 'text-red-400'
                            : q.discrimination < 0.3
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                        }`}
                      >
                        {fmt(q.discrimination)}
                      </td>
                    </tr>
                  ))}
                  {itemData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No evaluated questions yet for this exam.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
