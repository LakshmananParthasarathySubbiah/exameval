import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { extractError } from '../../utils';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const addToast = useUIStore((s) => s.addToast);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/evaluations');
    } catch (err) {
      addToast(extractError(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* Card */}
        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-white text-lg leading-none">ExamEval</h1>
              <p className="text-xs text-slate-500 mt-0.5">AI Evaluation Platform</p>
            </div>
          </div>

          <h2 className="text-xl font-display font-bold text-white mb-1">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="label text-slate-400">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="input bg-surface-800 border-surface-700 text-white placeholder-slate-600
                  focus:ring-brand-500"
                placeholder="admin@exameval.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label text-slate-400">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="input bg-surface-800 border-surface-700 text-white placeholder-slate-600
                    focus:ring-brand-500 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary justify-center w-full py-2.5 mt-1">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-surface-800">
            <p className="text-xs text-slate-600 mb-2 font-mono">Demo credentials:</p>
            <div className="flex flex-col gap-1 font-mono text-xs">
              <span className="text-slate-500">admin@exameval.com / <span className="text-brand-400">Admin@123</span></span>
              <span className="text-slate-500">staff@exameval.com / <span className="text-brand-400">Staff@123</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
