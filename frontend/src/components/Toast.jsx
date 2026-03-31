import { useUIStore } from '../store/uiStore';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
  error:   <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  info:    <Info className="w-4 h-4 text-blue-500 shrink-0" />,
};

const BG = {
  success: 'border-emerald-200 dark:border-emerald-800',
  error:   'border-red-200 dark:border-red-800',
  warning: 'border-amber-200 dark:border-amber-800',
  info:    'border-blue-200 dark:border-blue-800',
};

function Toast({ id, message, type = 'info' }) {
  const removeToast = useUIStore((s) => s.removeToast);
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl card border shadow-lg
      animate-slide-in-right min-w-[280px] max-w-sm ${BG[type]}`}>
      {ICONS[type]}
      <p className="text-sm text-slate-700 dark:text-slate-200 flex-1">{message}</p>
      <button onClick={() => removeToast(id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => <Toast key={t.id} {...t} />)}
    </div>
  );
}
