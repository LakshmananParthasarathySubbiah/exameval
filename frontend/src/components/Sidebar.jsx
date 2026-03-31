import { NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpen, GraduationCap, Users, FileText,
  BarChart3, LogOut, ChevronRight, Layers
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';

const NAV = [
  { to: '/courses',     label: 'Courses',     icon: BookOpen },
  { to: '/exams',       label: 'Exams',       icon: Layers },
  { to: '/students',    label: 'Students',    icon: Users },
  { to: '/scripts',     label: 'Scripts',     icon: FileText },
  { to: '/evaluations', label: 'Evaluations', icon: BarChart3 },
];

export default function Sidebar({ collapsed }) {
  const { user, logout } = useAuthStore();
  const addToast = useUIStore((s) => s.addToast);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    addToast('Logged out successfully', 'success');
    navigate('/login');
  };

  return (
    <aside className={`flex flex-col h-full bg-surface-950 dark:bg-surface-950 border-r border-surface-800
      transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-800">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <GraduationCap className="w-4.5 h-4.5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="font-display font-bold text-white text-sm tracking-wide">ExamEval</span>
            <span className="block text-xs text-slate-500 -mt-0.5">AI Evaluation</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
               ${isActive
                 ? 'bg-brand-600 text-white'
                 : 'text-slate-400 hover:text-white hover:bg-surface-800'}`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-2 pb-4 border-t border-surface-800 pt-3 flex flex-col gap-1">
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white uppercase">
                {user?.email?.[0] || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">{user?.email || 'User'}</p>
              <span className="text-xs text-brand-400 font-mono">{user?.role}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-surface-800 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
