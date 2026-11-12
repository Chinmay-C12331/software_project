import {
  AlertCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, ValidationResponse } from '../api.ts';
import { Layout } from '../components/Layout.tsx';
import { useRegistration } from '../context/RegistrationContext.tsx';

export const ConfirmPage: React.FC = () => {
  const {
    selectedCourseIds,
    waitlistCourseIds,
    moveCourseToWaitlistSelection,
    clearSelections,
    setLastConfirmation,
    refreshStudent,
    addToast,
  } = useRegistration();
  const navigate = useNavigate();

  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<{
    code: string;
    message: string;
    courseId?: number;
    courseCode?: string;
  } | null>(null);

  const allCombinedIds = Array.from(new Set([...selectedCourseIds, ...waitlistCourseIds]));

  const loadSummary = useCallback(async () => {
    if (allCombinedIds.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/registration/validate', {
        courseIds: allCombinedIds,
      });
      setValidation(res.data);
    } catch {
      addToast('error', 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [allCombinedIds.join(','), addToast]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (allCombinedIds.length === 0 && !loading) {
    return <Navigate to="/catalog" replace />;
  }

  const eligibleCourses = validation?.courses.filter((c) => c.status === 'ELIGIBLE') || [];
  const waitlistCourses =
    validation?.courses.filter((c) => c.status === 'FULL_WAITLIST_AVAILABLE') || [];

  const handleFinalConfirm = async () => {
    setSubmitting(true);
    setApiError(null);

    try {
      const res = await api.post('/registration/confirm', {
        courseIds: eligibleCourses.map((c) => c.courseId),
        waitlistCourseIds: waitlistCourses.map((c) => c.courseId),
      });

      setLastConfirmation(res.data);
      clearSelections();
      await refreshStudent();
      setShowModal(false);
      addToast('success', 'Registration Confirmed');
      navigate('/done');
    } catch (err: any) {
      setShowModal(false);
      const errObj = err.response?.data?.error;
      setApiError({
        code: errObj?.code || 'ERROR',
        message: errObj?.message || 'Registration failed.',
        courseId: errObj?.courseId,
        courseCode: errObj?.courseCode,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMoveConflictCourseToWaitlist = () => {
    if (!apiError?.courseId) return;
    moveCourseToWaitlistSelection(apiError.courseId);
    setApiError(null);
    loadSummary();
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Confirm Registration</h1>
          <button
            type="button"
            onClick={() => navigate('/review')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {apiError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-800"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{apiError.message}</span>
            </div>
            {apiError.code === 'SEAT_UNAVAILABLE' && apiError.courseId && (
              <button
                type="button"
                onClick={handleMoveConflictCourseToWaitlist}
                className="px-3 py-1 font-semibold text-white bg-amber-600 rounded cursor-pointer whitespace-nowrap"
              >
                Join Waitlist
              </button>
            )}
          </div>
        )}

        {loading || !validation ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E3A8A]" />
          </div>
        ) : (
          <>
            {eligibleCourses.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Selected Courses</span>
                  <span className="font-mono">{validation.creditCheck.total} / 24 Credits</span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 px-4">Code</th>
                      <th className="py-2 px-4">Name</th>
                      <th className="py-2 px-4">Faculty</th>
                      <th className="py-2 px-4 text-right">Credits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligibleCourses.map((c) => (
                      <tr key={c.courseId}>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#1E3A8A]">{c.code}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{c.name}</td>
                        <td className="py-2.5 px-4 text-slate-500">{c.faculty}</td>
                        <td className="py-2.5 px-4 text-right font-mono">{c.credits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {waitlistCourses.length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50 text-xs font-bold text-amber-900">
                  Waitlist Summary
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-amber-100 text-amber-800">
                      <th className="py-2 px-4">Code</th>
                      <th className="py-2 px-4">Name</th>
                      <th className="py-2 px-4 text-right">Queue Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {waitlistCourses.map((w) => (
                      <tr key={w.courseId}>
                        <td className="py-2.5 px-4 font-mono font-semibold text-amber-900">{w.code}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{w.name}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-700">
                          #{w.seats.currentWaitlistSize + (w.alreadyWaitlisted ? 0 : 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#1E3A8A]"
                />
                <span className="text-xs text-slate-700">
                  I confirm the selected courses for registration.
                </span>
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!agreed || !validation.valid || submitting}
                  onClick={() => setShowModal(true)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer"
                >
                  Confirm Registration
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-xs w-full p-5 shadow-lg space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Are you sure?</h2>
            <p className="text-xs text-slate-600">
              Confirm registration for {eligibleCourses.length} course(s)?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalConfirm}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
