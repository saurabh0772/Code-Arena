import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/Login';
import { Problems } from './pages/Problems';
import { ProblemDetails } from './pages/ProblemDetails';
import { SubmissionHistory } from './pages/SubmissionHistory';

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

              {/* Protected routes */}
              <Route
                path="/submissions"
                element={
                  <ProtectedRoute>
                    <SubmissionHistory />
                  </ProtectedRoute>
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
