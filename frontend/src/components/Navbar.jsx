import { Moon, Sun, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useUIStore } from '../store/uiStore';

export default function Navbar({ title, breadcrumb = [], collapsed, onToggle }) {
  const { theme, toggleTheme } = useUIStore();

  return (
    <header className="h-14 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-950
      flex items-center justify-between px-5 shrink-0 gap-4">

      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
            hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-1.5 text-sm">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300 dark:text-slate-700">/</span>}
              <span className={i === breadcrumb.length - 1
                ? 'font-semibold text-slate-900 dark:text-slate-100'
                : 'text-slate-500 dark:text-slate-500'}>
                {crumb}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
            hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
