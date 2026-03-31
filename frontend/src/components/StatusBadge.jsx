import { getStatusConfig } from '../utils';

export default function StatusBadge({ status, dot = true }) {
  const { label, color } = getStatusConfig(status);
  return (
    <span className={`badge ${color}`}>
      {dot && (
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${
          status === 'PROCESSING' ? 'animate-pulse-soft bg-current' : 'bg-current opacity-70'
        }`} />
      )}
      {label}
    </span>
  );
}
