import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Problems } from './pages/Problems';
import { ProblemDetails } from './pages/ProblemDetails';
import { Profile } from './pages/Profile';
import { SubmissionHistory } from './pages/SubmissionHistory';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminProblems } from './pages/admin/AdminProblems';
import { AdminProblemForm } from './pages/admin/AdminProblemForm';
import { AdminTestCases } from './pages/admin/AdminTestCases';

/**
 * Layout wrapper that conditionally renders the dark Navbar.
 * The Home page (`/`) has its own light-themed HomeNavbar,
 * so the global dark Navbar is hidden on that route.
 */
function AppLayout({ children }) {
  const location = useLocation();
  // Pages with their own light-themed layout (HomeNavbar + light background)
  const isLightPage =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/profile' ||
    location.pathname.startsWith('/problems') ||
    location.pathname.startsWith('/admin');

  return (
    <div className={`min-h-screen flex flex-col ${isLightPage ? '' : 'bg-background text-slate-100'} font-sans`}>
      {!isLightPage && <Navbar />}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

export function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout>
          <Routes>
            {/* Home / Landing page (light theme, own navbar) */}
            <Route path="/" element={<Home />} />

            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/problems" element={<Problems />} />
            <Route path="/problems/:problemId" element={<ProblemDetails />} />
            <Route path="/profile" element={<Profile />} />

            {/* User protected routes */}
            <Route
              path="/submissions"
              element={
                <ProtectedRoute>
                  <SubmissionHistory />
                </ProtectedRoute>
              }
            />

            {/* Admin protected routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/problems"
              element={
                <AdminRoute>
                  <AdminProblems />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/problems/create"
              element={
                <AdminRoute>
                  <AdminProblemForm mode="create" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/problems/:problemId/edit"
              element={
                <AdminRoute>
                  <AdminProblemForm mode="edit" />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/problems/:problemId/test-cases"
              element={
                <AdminRoute>
                  <AdminTestCases />
                </AdminRoute>
              }
            />

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </AuthProvider>
    </Router>
  );
}

export default App;
