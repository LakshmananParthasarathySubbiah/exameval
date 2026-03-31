import { getGrade } from '../utils';

export default function ScoreGauge({ percentage, size = 120, strokeWidth = 10 }) {
  const pct = percentage ?? 0;
  const { grade, color } = getGrade(pct);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const trackColor = 'stroke-surface-200 dark:stroke-surface-700';
  const gaugeColor =
    pct >= 80 ? 'stroke-emerald-500'
    : pct >= 60 ? 'stroke-brand-500'
    : pct >= 40 ? 'stroke-amber-400'
    : 'stroke-red-500';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth={strokeWidth}
            className={trackColor}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${gaugeColor} transition-all duration-700 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-bold text-slate-900 dark:text-slate-100"
            style={{ fontSize: size * 0.18 }}>
            {Math.round(pct)}%
          </span>
          <span className={`font-bold ${color}`} style={{ fontSize: size * 0.13 }}>
            {grade}
          </span>
        </div>
      </div>
    </div>
  );
}
