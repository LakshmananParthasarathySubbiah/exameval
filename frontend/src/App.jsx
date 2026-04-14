import { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useAuthStore as useStore } from './store/authStore';
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
      {/* Floating Toggle Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl flex items-center justify-center transition-all active:scale-95"
        title="AI Assistant"
      >
        {open ? (
          <span className="text-xl">✕</span>
        ) : (
          <span className="text-2xl">🤖</span>
        )}
      </button>

      {/* Chat Container */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px', // Sits above the button
            right: '24px',
            zIndex: 9998,
            width: 'min(90vw, 450px)', // Responsive width limits
            height: 'min(80vh, 700px)', // Responsive height limits
            display: 'flex',
            flexDirection: 'column',
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
            border: '1px solid #e2e8f0',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="font-semibold text-sm">DB Agent Assistant</span>
            </div>
            <button 
              onClick={() => setOpen(false)}
              className="hover:bg-slate-800 p-1 rounded-md transition-colors leading-none"
            >
              ✕
            </button>
          </div>

          {/* Iframe Body - Ensuring no overflow or clipping */}
          <div className="flex-1 w-full h-full bg-white relative">
            <iframe
              src="https://db-agent-lup9.vercel.app/"
              className="absolute inset-0 w-full h-full border-none block"
              title="AI Assistant"
              allow="clipboard-read; clipboard-write; microphone"
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
      <AxiosSetup />
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