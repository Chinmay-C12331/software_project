import { CheckCircle2, Printer } from 'lucide-react';
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.tsx';
import { useRegistration } from '../context/RegistrationContext.tsx';

export const ConfirmationPage: React.FC = () => {
  const { lastConfirmation } = useRegistration();
  const navigate = useNavigate();

  if (!lastConfirmation) {
    return <Navigate to="/my-registrations" replace />;
  }

  const {
    registration,
    registeredCourses,
    waitlistedCourses,
    totalRegisteredCredits,
    student,
  } = lastConfirmation;

  const formattedDate = new Date(registration.created_at).toLocaleString();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 print-card space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">Registration Confirmed</h1>
                <p className="text-xs text-emerald-700 font-medium">
                  Your academic record has been updated
                </p>
              </div>
            </div>

            <div className="text-xs sm:text-right font-mono">
              <p className="font-bold text-[#1E3A8A]">{registration.registration_code}</p>
              <p className="text-slate-500 text-[11px]">{formattedDate}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span className="text-slate-400 block">Name</span>
              <span className="font-semibold text-slate-900">{student.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Student ID</span>
              <span className="font-mono font-semibold text-[#1E3A8A]">{student.student_code}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Department</span>
              <span className="font-semibold text-slate-900">
                {student.department} (Sem {student.semester})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Total Credits</span>
              <span className="font-mono font-bold text-emerald-700">
                {totalRegisteredCredits} / {student.credit_limit}
              </span>
            </div>
          </div>

          {registeredCourses.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Credits</th>
                    <th className="py-2 px-3">Faculty</th>
                    <th className="py-2 px-3">Schedule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registeredCourses.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#1E3A8A]">{c.code}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono">{c.credits}</td>
                      <td className="py-2.5 px-3 text-slate-600">{c.faculty}</td>
                      <td className="py-2.5 px-3 text-slate-500">{c.schedule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {waitlistedCourses.length > 0 && (
            <div className="border border-amber-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-amber-50 border-b border-amber-200 font-semibold text-amber-900">
                    <th className="py-2 px-3">Waitlisted Course</th>
                    <th className="py-2 px-3 text-right">Queue Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {waitlistedCourses.map((w) => (
                    <tr key={w.courseId}>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {w.code} — {w.name}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                        #{w.position}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-blue-900 rounded-lg cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};
