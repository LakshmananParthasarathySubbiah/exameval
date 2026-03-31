import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { evaluationsApi, examsApi } from '../../api/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { usePagination } from '../../hooks';
import { formatDate, formatScore, formatPercent } from '../../utils';

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function EvaluationsPage() {
  const navigate = useNavigate();
  const [examFilter, setExamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { page, limit, goToPage } = usePagination(20);

  const { data, isLoading } = useQuery({
    queryKey: ['evaluations', page, examFilter, statusFilter],
    queryFn: () => evaluationsApi.list({ page, limit, ...(examFilter && { examId: examFilter }), ...(statusFilter && { status: statusFilter }) }).then((r) => r.data),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['eval-summary', examFilter],
    queryFn: () => examFilter ? evaluationsApi.summary(examFilter).then((r) => r.data) : Promise.resolve({ data: null }),
    enabled: !!examFilter,
  });

  const { data: examsData } = useQuery({
    queryKey: ['exams-all'],
    queryFn: () => examsApi.list({ limit: 100 }).then((r) => r.data),
  });

  const exams = examsData?.data || [];
  const summary = summaryData?.data;

  const columns = [
    {
      key: 'script', label: 'Student',
      render: (v) => (
        <div>
          <div className="font-medium text-slate-800 dark:text-slate-200">{v?.student?.name}</div>
          <div className="text-xs font-mono text-slate-400">{v?.student?.rollNumber}</div>
        </div>
      ),
    },
    {
      key: 'totalScore', label: 'Score',
      render: (v, row) => (
        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
          {formatScore(row.overrideScore ?? v, row.maxScore)}
        </span>
      ),
    },
    {
      key: 'percentage', label: '%',
      render: (v, row) => {
        const pct = row.overrideScore != null ? (row.overrideScore / row.maxScore * 100) : v;
        const color = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500';
        return <span className={`font-mono font-bold ${color}`}>{formatPercent(pct)}</span>;
      },
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'staffReviewed', label: 'Reviewed', render: (v) => v ? <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✓ Reviewed</span> : <span className="text-slate-400 text-xs">—</span> },
    { key: 'createdAt', label: 'Date', sortable: true, render: (v) => formatDate(v) },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">Evaluations</h1>
        <p className="text-sm text-slate-500 mt-0.5">AI-generated evaluation results</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={BarChart3} label="Total Evaluated" value={summary.completed} color="bg-brand-600" />
          <SummaryCard icon={CheckCircle} label="Avg Score" value={`${summary.avgScore?.toFixed(1)}%`} color="bg-emerald-500" />
          <SummaryCard icon={AlertTriangle} label="Needs Review" value={summary.pendingReview} color="bg-amber-500" />
          <SummaryCard icon={Clock} label="Total Students" value={summary.total} color="bg-slate-500" />
        </div>
      )}

      <div className="card p-5 flex flex-col gap-4">
        <div className="flex gap-3 flex-wrap">
          <select className="input max-w-xs" value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
            <option value="">All exams</option>
            {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
          <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PENDING_REVIEW'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          pagination={data?.pagination}
          onPageChange={goToPage}
          onRowClick={(row) => navigate(`/evaluations/${row.id}`)}
          emptyMessage="No evaluations found. Run evaluations from the Scripts page."
        />
      </div>
    </div>
  );
}
