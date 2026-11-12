import { AlertCircle, Eye, EyeOff, GraduationCap, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
import { Layout } from '../components/Layout.tsx';
import { useRegistration } from '../context/RegistrationContext.tsx';

export const LoginPage: React.FC = () => {
  const { student, login, addToast } = useRegistration();
  const navigate = useNavigate();

  const [studentCode, setStudentCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ studentCode?: string; password?: string }>({});

  if (student) {
    return <Navigate to="/catalog" replace />;
  }

  const validateFields = () => {
    const errs: { studentCode?: string; password?: string } = {};
    if (!studentCode.trim()) {
      errs.studentCode = 'Student ID is required.';
    }
    if (!password) {
      errs.password = 'Password is required.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!validateFields()) return;

    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        studentCode: studentCode.trim(),
        password,
      });
      login(res.data.token, res.data.student);
      addToast('success', `Welcome, ${res.data.student.name}`);
      navigate('/catalog');
    } catch (err: any) {
      const serverMsg =
        err.response?.data?.error?.message || 'Invalid Student ID or password.';
      setErrorMessage(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-7 shadow-xs">
          <div className="text-center mb-6">
            <div className="w-11 h-11 mx-auto rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center mb-3">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Student Login</h1>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="studentCode" className="block text-xs font-semibold text-slate-700 mb-1">
                Student ID
              </label>
              <input
                id="studentCode"
                name="studentCode"
                type="text"
                autoComplete="username"
                value={studentCode}
                onChange={(e) => {
                  setStudentCode(e.target.value);
                  if (fieldErrors.studentCode) setFieldErrors({ ...fieldErrors, studentCode: undefined });
                }}
                placeholder="e.g. 20241CSE0837"
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 ${
                  fieldErrors.studentCode
                    ? 'border-red-400 focus:ring-red-100'
                    : 'border-slate-300 focus:border-[#1E3A8A] focus:ring-blue-100'
                }`}
              />
              {fieldErrors.studentCode && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.studentCode}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                  }}
                  placeholder="Enter password"
                  className={`w-full pl-3 pr-9 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 ${
                    fieldErrors.password
                      ? 'border-red-400 focus:ring-red-100'
                      : 'border-slate-300 focus:border-[#1E3A8A] focus:ring-blue-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#1E3A8A] hover:bg-blue-900 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          <p className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center font-mono">
            Demo: 20241CSE0837 – 20241CSE0841 / student123
          </p>
        </div>
      </div>
    </Layout>
  );
};
