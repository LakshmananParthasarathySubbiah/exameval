import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { setAuthStoreRef } from './api/axios';
import { useUIStore } from './store/uiStore';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ToastContainer from './components/Toast';
import LoginPage from './pages/Login';
import CoursesPage from './pages/Courses';
import ExamsPage from './pages/Exams';
import StudentsPage from './pages/Students';
import ScriptsPage from './pages/Scripts';
import EvaluationsPage from './pages/Evaluations';
import EvaluationDetailPage from './pages/EvaluationDetail';
import AnalyticsPage from './pages/Analytics';
import { examsApi, assistantApi } from './api/resources';
import { useRef } from 'react';
import { useAuthStore as useStore } from './store/authStore';

function AxiosSetup() {
  const storeRef = useRef(useStore);
  useEffect(() => { setAuthStoreRef(storeRef.current); }, []);
  return null;
}

const PAGE_META = {
  '/courses':     { title: 'Courses',     breadcrumb: ['Courses'] },
  '/exams':       { title: 'Exams',       breadcrumb: ['Exams'] },
  '/students':    { title: 'Students',    breadcrumb: ['Students'] },
  '/scripts':     { title: 'Scripts',     breadcrumb: ['Scripts'] },
  '/evaluations': { title: 'Evaluations', breadcrumb: ['Evaluations'] },
  '/analytics':   { title: 'Analytics',   breadcrumb: ['Analytics'] },
};

// Real, data-grounded assistant: asks the backend /assistant/ask endpoint,
// which runs RAG over the user's own exam analytics. (Replaces the old iframe.)
const GREETING = {
  role: 'assistant',
  text: "Hi! I'm your data assistant. Ask me about courses, exams, students, scores, or analytics — I look it up live from your data.",
};
const SUGGESTED = [
  'Give me an overview',
  'Which question was hardest?',
  'Who are the top 3 students?',
];

function ChatbotPopup() {
  const [open, setOpen] = useState(false);
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && exams.length === 0) {
      examsApi
        .list({ limit: 100 })
        .then((r) => setExams(r.data?.data || []))
        .catch(() => {});
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const ask = async (q) => {
    if (!q || loading) return;
    // Send prior turns as conversation history (backend caps to last 6).
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.text }));
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    try {
      const r = await assistantApi.ask({ question: q, examId: examId || undefined, history });
      const d = r.data?.data || {};
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: d.answer || 'No answer.', tools: d.usedTools || [] },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: err.response?.data?.error || 'Assistant request failed.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-xl text-white shadow-lg hover:bg-brand-500"
        title="AI Assistant"
      >
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[9998] flex h-[560px] max-h-[82vh] w-[400px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-surface-800 bg-surface-950 px-4 py-3">
            <span className="text-sm font-semibold text-white">🤖 Data Assistant</span>
            <div className="flex items-center gap-2">
              <select
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                className="max-w-[150px] rounded border border-surface-700 bg-surface-800 px-2 py-1 text-xs text-slate-200"
                title="Optional: focus on one exam"
              >
                <option value="">All data</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setMessages([GREETING])}
                className="rounded border border-surface-700 px-2 py-1 text-xs text-slate-400 hover:text-white"
                title="Reset conversation"
              >
                Reset
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                <span
                  className={`inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-surface-800 text-slate-200'
                  }`}
                >
                  {m.text}
                </span>
                {m.tools?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.tools.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-surface-950 px-1.5 py-0.5 font-mono text-[10px] text-brand-400"
                        title="Data tool the assistant used"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="rounded-full border border-surface-700 px-3 py-1 text-xs text-slate-300 hover:border-brand-500 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && <div className="text-xs text-slate-500">Thinking…</div>}
          </div>

          <div className="flex gap-2 border-t border-surface-800 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask(input.trim())}
              placeholder="Ask about your data…"
              className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            />
            <button
              onClick={() => ask(input.trim())}
              disabled={loading}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm text-white hover:bg-brand-500 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ||
    (location.pathname.startsWith('/evaluations/')
      ? { title: 'Evaluation Detail', breadcrumb: ['Evaluations', 'Detail'] }
      : { title: 'ExamEval', breadcrumb: [] });
  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950">
      <Sidebar collapsed={collapsed} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar
          title={meta.title}
          breadcrumb={meta.breadcrumb}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { user, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    setAuthStoreRef({ getState: () => useAuthStore.getState() });
    init();
  }, []);
  return (
    <BrowserRouter>
      <ToastContainer />
      <ChatbotPopup />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/evaluations" replace />} />
            <Route path="/courses"            element={<CoursesPage />} />
            <Route path="/exams"              element={<ExamsPage />} />
            <Route path="/students"           element={<StudentsPage />} />
            <Route path="/scripts"            element={<ScriptsPage />} />
            <Route path="/evaluations"        element={<EvaluationsPage />} />
            <Route path="/evaluations/:id"    element={<EvaluationDetailPage />} />
            <Route path="/analytics"          element={<AnalyticsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}