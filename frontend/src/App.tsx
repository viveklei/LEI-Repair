import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navigation from './components/Navigation';
import ToastContainer from './components/Toast';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// ─── Lazy-loaded pages for code splitting ─────────────────────────────────────
const Login          = lazy(() => import('./pages/Login'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const JobsList       = lazy(() => import('./pages/JobsList'));
const JobWorkflow    = lazy(() => import('./pages/JobWorkflow'));
const Customers      = lazy(() => import('./pages/Customers'));
const SpareParts     = lazy(() => import('./pages/SpareParts'));
const Reports        = lazy(() => import('./pages/Reports'));
const Users          = lazy(() => import('./pages/Users'));
const Approvals      = lazy(() => import('./pages/Approvals'));
const CustomerPortal = lazy(() => import('./pages/CustomerPortal'));
const PublicTracker  = lazy(() => import('./pages/PublicTracker'));

// ─── Page-level skeleton loader ───────────────────────────────────────────────
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
        <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin" />
      </div>
      <p className="text-sm font-semibold text-slate-400 animate-pulse">Loading...</p>
    </div>
  </div>
);

// ─── Auth gate ────────────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, loading, isPortal } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (isPortal && !window.location.hash.startsWith('#/portal') && !window.location.pathname.startsWith('/portal')) {
    return <Navigate to={`/portal/job/${localStorage.getItem('portalJobId')}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Navigation>{children}</Navigation>;
};

const AppContent: React.FC = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public */}
      <Route path="/login"          element={<Login />} />
      <Route path="/track/:trackId" element={<PublicTracker />} />

      {/* Staff dashboards */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><JobsList /></ProtectedRoute>} />
      <Route path="/jobs/:id" element={<ProtectedRoute><JobWorkflow /></ProtectedRoute>} />
      <Route path="/customers" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'ACCOUNTS', 'SUPPORT']}><Customers /></ProtectedRoute>
      } />
      <Route path="/spare-parts" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'ENGINEER', 'ACCOUNTS', 'SUPPORT']}><SpareParts /></ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'ACCOUNTS']}><Reports /></ProtectedRoute>
      } />
      <Route path="/approvals" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'ACCOUNTS', 'SUPPORT']}><Approvals /></ProtectedRoute>
      } />
      <Route path="/users" element={
        <ProtectedRoute allowedRoles={['ADMIN']}><Users /></ProtectedRoute>
      } />

      {/* Customer portal */}
      <Route path="/portal/job/:id" element={
        <ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerPortal /></ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);

const App: React.FC = () => (
  <Router>
    <ToastProvider>
      <AuthProvider>
        <AppContent />
        <ToastContainer />
        <PWAInstallPrompt />
      </AuthProvider>
    </ToastProvider>
  </Router>
);

export default App;
