import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { setAuthStoreRef } from './api/axios';
import { useUIStore } from './store/uiStore';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import ToastContainer from './components/Toast';

// Pages
import LoginPage from './pages/Login';
import CoursesPage from './pages/Courses';
import ExamsPage from './pages/Exams';
import StudentsPage from './pages/Students';
import ScriptsPage from './pages/Scripts';
import EvaluationsPage from './pages/Evaluations';
import EvaluationDetailPage from './pages/EvaluationDetail';

// Wire auth store to axios interceptors
import { useRef } from 'react';
import { useAuthStore as useStore } from './store/authStore';

function AxiosSetup() {
  const storeRef = useRef(useStore);
  useEffect(() => { setAuthStoreRef(storeRef.current); }, []);
  return null;
}

// Page title/breadcrumb map
const PAGE_META = {
  '/courses':     { title: 'Courses',     breadcrumb: ['Courses'] },
  '/exams':       { title: 'Exams',       breadcrumb: ['Exams'] },
  '/students':    { title: 'Students',    breadcrumb: ['Students'] },
  '/scripts':     { title: 'Scripts',     breadcrumb: ['Scripts'] },
  '/evaluations': { title: 'Evaluations', breadcrumb: ['Evaluations'] },
};

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
    // Wire axios store ref first
    setAuthStoreRef({ getState: () => useAuthStore.getState() });
    init();
  }, []);

  return (
    <BrowserRouter>
      <ToastContainer />
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
