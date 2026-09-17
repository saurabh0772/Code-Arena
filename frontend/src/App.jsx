import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { Login } from './pages/Login';
import { Problems } from './pages/Problems';
import { ProblemDetails } from './pages/ProblemDetails';
import { SubmissionHistory } from './pages/SubmissionHistory';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminProblems } from './pages/admin/AdminProblems';
import { AdminProblemForm } from './pages/admin/AdminProblemForm';
import { AdminTestCases } from './pages/admin/AdminTestCases';

export function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-background text-slate-100 font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/problems" element={<Problems />} />
              <Route path="/problems/:problemId" element={<ProblemDetails />} />

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

              {/* Default redirects */}
              <Route path="/" element={<Navigate to="/problems" replace />} />
              <Route path="*" element={<Navigate to="/problems" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
