// ── Date formatting ───────────────────────────────────────────────────────────
export const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (date) =>
  date ? new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ── Score formatting ──────────────────────────────────────────────────────────
export const formatScore = (score, max) =>
  score != null && max != null ? `${Number(score).toFixed(0)}/${Number(max).toFixed(0)}` : '—';

export const formatPercent = (pct) =>
  pct != null ? `${Number(pct).toFixed(1)}%` : '—';

// ── Status helpers ────────────────────────────────────────────────────────────
export const STATUS_CONFIG = {
  UPLOADED:       { label: 'Uploaded',       color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  PROCESSING:     { label: 'Processing',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  EVALUATED:      { label: 'Evaluated',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  FAILED:         { label: 'Failed',         color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  PENDING:        { label: 'Pending',        color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  COMPLETED:      { label: 'Completed',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  PENDING_REVIEW: { label: 'Needs Review',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

export const getStatusConfig = (status) =>
  STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100 text-slate-600' };

// ── Confidence helpers ────────────────────────────────────────────────────────
export const confidenceColor = (confidence) => {
  if (confidence >= 0.8) return 'bg-emerald-500';
  if (confidence >= 0.6) return 'bg-amber-400';
  return 'bg-red-500';
};

export const confidenceLabel = (confidence) => {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  return 'Low';
};

// ── Grade helpers ─────────────────────────────────────────────────────────────
export const getGrade = (pct) => {
  if (pct >= 90) return { grade: 'O', color: 'text-emerald-600' };
  if (pct >= 80) return { grade: 'A+', color: 'text-emerald-500' };
  if (pct >= 70) return { grade: 'A', color: 'text-blue-500' };
  if (pct >= 60) return { grade: 'B+', color: 'text-brand-500' };
  if (pct >= 50) return { grade: 'B', color: 'text-amber-500' };
  if (pct >= 40) return { grade: 'C', color: 'text-orange-500' };
  return { grade: 'F', color: 'text-red-500' };
};

// ── Error extraction ──────────────────────────────────────────────────────────
export const extractError = (err) =>
  err?.response?.data?.error || err?.message || 'Something went wrong';

// ── CSV parsing ───────────────────────────────────────────────────────────────
export const parseCSV = (text) => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
  });
};

// ── Pagination helpers ────────────────────────────────────────────────────────
export const totalPages = (total, limit) => Math.max(1, Math.ceil(total / limit));
