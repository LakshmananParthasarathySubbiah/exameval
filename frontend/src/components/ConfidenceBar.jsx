import { confidenceColor, confidenceLabel } from '../utils';

export default function ConfidenceBar({ confidence, showLabel = true }) {
  const pct = Math.round((confidence ?? 0) * 100);
  const colorClass = confidenceColor(confidence ?? 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-8 text-right">
          {pct}%
        </span>
      )}
    </div>
  );
}
