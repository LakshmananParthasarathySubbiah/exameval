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
};

function ChatbotPopup() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#4f46e5',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(79,70,229,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          color: 'white',
        }}
        title="AI Assistant"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Full screen overlay modal */}
      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div style={{
            width: '100%',
            height: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            background: 'white',
          }}>
            {/* Header bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: '#0f172a',
              borderBottom: '1px solid #1e293b',
              flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: '15px' }}>
                🤖 AI Assistant
              </span>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '20px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
              >
                ✕
              </button>
            </div>

            {/* iframe takes full remaining space */}
            <iframe
              src="https://db-agent-lup9.vercel.app/"
              style={{
                flex: 1,
                width: '100%',
                border: 'none',
                display: 'block',
              }}
              title="AI Assistant"
            />
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
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}