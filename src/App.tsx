import { Loader2 } from 'lucide-react';
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RegistrationProvider, useRegistration } from './context/RegistrationContext.tsx';
import { AcademicRecordPage } from './pages/AcademicRecordPage.tsx';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { ConfirmationPage } from './pages/ConfirmationPage.tsx';
import { ConfirmPage } from './pages/ConfirmPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { MyRegistrationsPage } from './pages/MyRegistrationsPage.tsx';
import { ReviewPage } from './pages/ReviewPage.tsx';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { student, loadingAuth } = useRegistration();

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-700">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E3A8A] mb-3" />
        <p className="text-sm font-semibold">Verifying student session...</p>
      </div>
    );
  }

  if (!student) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <RegistrationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/catalog"
            element={
              <ProtectedRoute>
                <CatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/review"
            element={
              <ProtectedRoute>
                <ReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/confirm"
            element={
              <ProtectedRoute>
                <ConfirmPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/done"
            element={
              <ProtectedRoute>
                <ConfirmationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-registrations"
            element={
              <ProtectedRoute>
                <MyRegistrationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic-record"
            element={
              <ProtectedRoute>
                <AcademicRecordPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </BrowserRouter>
    </RegistrationProvider>
  );
}
