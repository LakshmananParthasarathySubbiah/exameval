import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, ChevronRight, RefreshCw, CheckCircle,
  AlertTriangle, Loader2, ArrowLeft, User, BookOpen, Clock
} from 'lucide-react';
import { evaluationsApi } from '../../api/resources';
import StatusBadge from '../../components/StatusBadge';
import ScoreGauge from '../../components/ScoreGauge';
import ConfidenceBar from '../../components/ConfidenceBar';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { useSSE } from '../../hooks';
import { formatDate, formatDateTime, formatScore, formatPercent, extractError } from '../../utils';

// ── Per-question accordion row ─────────────────────────────────────────────────
function QuestionRow({ q, index }) {
  const [open, setOpen] = useState(false);
  const scorePct = q.maxScore > 0 ? (q.score / q.maxScore) * 100 : 0;
  const scoreColor = scorePct >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : scorePct >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';

  return (
    <div className="border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-surface-50 dark:hover:bg-surface-900 transition-colors"
      >
        <span className="font-mono text-xs font-bold text-slate-500 w-8 shrink-0">{q.questionNumber}</span>
        <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{q.questionText}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`badge ${scoreColor}`}>{q.score}/{q.maxScore}</span>
          <div className="w-20 hidden sm:block">
            <ConfidenceBar confidence={q.confidence} showLabel={false} />
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-surface-100 dark:border-surface-800 space-y-4 animate-fade-in">
          {/* Student answer */}
          {q.studentAnswer && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Student Answer</p>
              <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                {q.studentAnswer || <span className="italic text-slate-400">No answer provided</span>}
              </div>
            </div>
          )}

          {/* Feedback */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Feedback</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{q.feedback}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Strengths */}
            {q.strengths?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Strengths
                </p>
                <ul className="space-y-1">
                  {q.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className="text-emerald-500 mt-0.5 shrink-0">•</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mistakes */}
            {q.mistakes?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Mistakes
                </p>
                <ul className="space-y-1">
                  {q.mistakes.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <span className="text-red-400 mt-0.5 shrink-0">•</span>{m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confidence */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Confidence</p>
            <ConfidenceBar confidence={q.confidence} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff Review Panel ─────────────────────────────────────────────────────────
function StaffReviewPanel({ evaluation, onReview }) {
  const [form, setForm] = useState({
    overrideScore: evaluation.overrideScore ?? '',
    staffNotes: evaluation.staffNotes ?? '',
    staffReviewed: evaluation.staffReviewed,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div className="card p-5 flex flex-col gap-4">
      <h3 className="font-display font-bold text-slate-900 dark:text-slate-100">Staff Review</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Override Score <span className="text-slate-400 font-normal">(leave blank to keep AI score)</span></label>
          <input
            type="number"
            className="input"
            value={form.overrideScore}
            onChange={set('overrideScore')}
            min={0}
            max={evaluation.maxScore}
            placeholder={`0 – ${evaluation.maxScore}`}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={form.staffReviewed}
              onChange={set('staffReviewed')}
              className="w-4 h-4 rounded accent-brand-600"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mark as Reviewed</span>
          </label>
        </div>
      </div>

      <div>
        <label className="label">Staff Notes</label>
        <textarea
          className="input resize-none"
          rows={3}
          value={form.staffNotes}
          onChange={set('staffNotes')}
          placeholder="Add review notes or reason for score override…"
        />
      </div>

      <button
        onClick={() => onReview({
          overrideScore: form.overrideScore !== '' ? Number(form.overrideScore) : undefined,
          staffNotes: form.staffNotes,
          staffReviewed: form.staffReviewed,
        })}
        className="btn-primary self-start"
      >
        Submit Review
      </button>
    </div>
  );
}

// ── Audit Trail ────────────────────────────────────────────────────────────────
function AuditTrail({ auditLogs }) {
  if (!auditLogs?.length) return null;
  return (
    <div className="card p-5">
      <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 mb-4">Audit Trail</h3>
      <div className="flex flex-col gap-2">
        {auditLogs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 shrink-0" />
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">{log.user?.email}</span>
              <span className="text-slate-500"> · {log.action.replace('_', ' ')}</span>
              {log.prevScore != null && (
                <span className="text-slate-500"> · {log.prevScore} → {log.newScore}</span>
              )}
              {log.reason && <span className="text-slate-500"> · "{log.reason}"</span>}
              <span className="block text-xs text-slate-400">{formatDateTime(log.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Live Progress Bar ──────────────────────────────────────────────────────────
function LiveProgress({ liveStatus }) {
  if (!liveStatus || liveStatus.status === 'CONNECTED') return null;
  const { message, currentQuestion, totalQuestions, status } = liveStatus;
  const pct = totalQuestions > 0 ? Math.round((currentQuestion / totalQuestions) * 100) : 0;

  return (
    <div className="card p-4 border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/20">
      <div className="flex items-center gap-3 mb-2">
        <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
        <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{message}</span>
        {currentQuestion && totalQuestions && (
          <span className="text-xs text-brand-500 ml-auto">{currentQuestion}/{totalQuestions}</span>
        )}
      </div>
      {totalQuestions > 0 && (
        <div className="h-1.5 bg-brand-100 dark:bg-brand-900 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EvaluationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const { user } = useAuthStore();
  const [liveStatus, setLiveStatus] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['evaluation', id],
    queryFn: () => evaluationsApi.get(id).then((r) => r.data),
  });

  const evaluation = data?.data;
  const isActive = evaluation?.status === 'PROCESSING' || evaluation?.status === 'PENDING';

  // SSE connection for live updates
  useSSE(id, {
    enabled: isActive,
    onMessage: (d) => setLiveStatus(d),
    onComplete: () => { refetch(); setLiveStatus(null); addToast('Evaluation complete!', 'success'); },
    onFailed: (d) => { refetch(); setLiveStatus(null); addToast(`Evaluation failed: ${d.message}`, 'error'); },
  });

  const retry = useMutation({
    mutationFn: () => evaluationsApi.retry(id),
    onSuccess: () => { refetch(); addToast('Retry queued', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  const review = useMutation({
    mutationFn: (d) => evaluationsApi.review(id, d),
    onSuccess: () => { refetch(); addToast('Review submitted', 'success'); },
    onError: (e) => addToast(extractError(e), 'error'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!evaluation) return <div className="text-slate-500">Evaluation not found.</div>;

  const { script, breakdown, auditLogs } = evaluation;
  const student = script?.student;
  const effectiveScore = evaluation.overrideScore ?? evaluation.totalScore;
  const effectivePct = evaluation.maxScore > 0 ? (effectiveScore / evaluation.maxScore) * 100 : evaluation.percentage;

  return (
    <div className="flex flex-col gap-6 max-w-4xl animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate('/evaluations')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 self-start">
        <ArrowLeft className="w-4 h-4" /> Back to Evaluations
      </button>

      {/* Header */}
      <div className="card p-6 flex flex-col sm:flex-row gap-6">
        <ScoreGauge percentage={effectivePct} size={120} />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-100">
                {student?.name}
              </h1>
              <p className="font-mono text-sm text-slate-500">{student?.rollNumber}</p>
            </div>
            <StatusBadge status={evaluation.status} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Score</p>
              <p className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
                {formatScore(effectiveScore, evaluation.maxScore)}
                {evaluation.overrideScore != null && (
                  <span className="text-xs text-amber-500 ml-1 font-normal">(overridden)</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Percentage</p>
              <p className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">{formatPercent(effectivePct)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Exam</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{script?.exam?.title}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(evaluation.createdAt)}</span>
            {evaluation.staffReviewed && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle className="w-3 h-3" />Staff Reviewed</span>}
          </div>
        </div>
      </div>

      {/* Live progress */}
      {liveStatus && <LiveProgress liveStatus={liveStatus} />}

      {/* Retry */}
      {evaluation.status === 'FAILED' && (
        <div className="card p-4 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Evaluation failed</span>
          </div>
          <button onClick={() => retry.mutate()} disabled={retry.isPending} className="btn-secondary text-xs">
            {retry.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Retry
          </button>
        </div>
      )}

      {/* Question breakdown */}
      {breakdown && breakdown.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100">Question Breakdown</h2>
          {breakdown.map((q, i) => <QuestionRow key={i} q={q} index={i} />)}
        </div>
      )}

      {/* Staff review (STAFF + ADMIN) */}
      {(user?.role === 'STAFF' || user?.role === 'ADMIN') && evaluation.status !== 'PENDING' && evaluation.status !== 'PROCESSING' && (
        <StaffReviewPanel evaluation={evaluation} onReview={(d) => review.mutate(d)} />
      )}

      {/* Audit trail */}
      <AuditTrail auditLogs={auditLogs} />
    </div>
  );
}
