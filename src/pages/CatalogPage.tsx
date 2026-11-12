import {
  ArrowRight,
  Check,
  LayoutGrid,
  List,
  Lock,
  Plus,
  Search,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Course } from '../api.ts';
import { Layout } from '../components/Layout.tsx';
import { useRegistration } from '../context/RegistrationContext.tsx';

export const CatalogPage: React.FC = () => {
  const {
    selectedCourseIds,
    waitlistCourseIds,
    toggleCourseSelection,
    toggleWaitlistSelection,
    addToast,
  } = useRegistration();
  const navigate = useNavigate();

  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [currentRegisteredCredits, setCurrentRegisteredCredits] = useState(0);
  const [creditLimit, setCreditLimit] = useState(24);
  const [loading, setLoading] = useState(true);
  const [joiningWaitlistId, setJoiningWaitlistId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [creditsFilter, setCreditsFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('code');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/courses');
      setAllCourses(res.data.courses);
      setCurrentRegisteredCredits(res.data.meta.currentRegisteredCredits);
      setCreditLimit(res.data.meta.creditLimit);
    } catch {
      addToast('error', 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const filteredCourses = useMemo(() => {
    let list = [...allCourses];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.faculty.toLowerCase().includes(q)
      );
    }

    if (departmentFilter !== 'ALL') {
      list = list.filter((c) => c.department === departmentFilter);
    }

    if (creditsFilter !== 'ALL') {
      list = list.filter((c) => c.credits === Number(creditsFilter));
    }

    if (availabilityFilter === 'AVAILABLE') {
      list = list.filter((c) => c.available_seats > 0);
    } else if (availabilityFilter === 'FULL') {
      list = list.filter((c) => c.available_seats === 0);
    }

    if (sortBy === 'credits_desc') {
      list.sort((a, b) => b.credits - a.credits || a.code.localeCompare(b.code));
    } else if (sortBy === 'seats_asc') {
      list.sort((a, b) => a.available_seats - b.available_seats || a.code.localeCompare(b.code));
    } else if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => a.code.localeCompare(b.code));
    }

    return list;
  }, [allCourses, search, departmentFilter, creditsFilter, availabilityFilter, sortBy]);

  const selectedCredits = useMemo(() => {
    return allCourses
      .filter((c) => selectedCourseIds.includes(c.id))
      .reduce((sum, c) => sum + c.credits, 0);
  }, [allCourses, selectedCourseIds]);

  const totalProjectedCredits = currentRegisteredCredits + selectedCredits;
  const creditExceeded = totalProjectedCredits > creditLimit;
  const creditNearLimit = !creditExceeded && totalProjectedCredits >= 19;

  const creditMeterColor = creditExceeded
    ? 'bg-red-600'
    : creditNearLimit
    ? 'bg-amber-500'
    : 'bg-emerald-600';

  const creditTextColor = creditExceeded
    ? 'text-red-700'
    : creditNearLimit
    ? 'text-amber-700'
    : 'text-emerald-700';

  const handleToggleCourse = (course: Course) => {
    if (!course.prerequisitesPassed) return;
    toggleCourseSelection(course.id);
  };

  const handleJoinWaitlistDirect = async (course: Course) => {
    if (!course.prerequisitesPassed) return;

    if (!waitlistCourseIds.includes(course.id) && !course.isWaitlisted) {
      toggleWaitlistSelection(course.id);
    }

    setJoiningWaitlistId(course.id);
    try {
      const res = await api.post('/waitlist/join', { courseId: course.id });
      addToast('warning', `Joined Waiting List (#${res.data.entry.position})`);
      await fetchCourses();
    } catch (err: any) {
      addToast('error', err.response?.data?.error?.message || 'Could not join waiting list');
    } finally {
      setJoiningWaitlistId(null);
    }
  };

  const totalActionableSelected = selectedCourseIds.length + waitlistCourseIds.length;

  return (
    <Layout>
      {/* Sticky Credit Meter */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Credits:</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${creditMeterColor}`}
                style={{ width: `${Math.min(100, (totalProjectedCredits / creditLimit) * 100)}%` }}
              />
            </div>
            <span className={`text-xs font-mono font-bold tabular-nums whitespace-nowrap ${creditTextColor}`}>
              {totalProjectedCredits} / {creditLimit}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/review')}
            disabled={totalActionableSelected === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors cursor-pointer"
          >
            <span>Review ({totalActionableSelected})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Search, Filters & Sort */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search courses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, name, or faculty..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:border-[#1E3A8A] focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
              <option value="HSS">HSS</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by credits"
              value={creditsFilter}
              onChange={(e) => setCreditsFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="ALL">All Credits</option>
              <option value="4">4 Credits</option>
              <option value="3">3 Credits</option>
              <option value="2">2 Credits</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by availability"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="ALL">All Availability</option>
              <option value="AVAILABLE">Available</option>
              <option value="FULL">Full</option>
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center gap-1.5">
            <select
              aria-label="Sort courses"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="code">Sort: Code</option>
              <option value="name">Sort: Name</option>
              <option value="credits_desc">Sort: Credits</option>
              <option value="seats_asc">Sort: Seats</option>
            </select>

            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                aria-label="Cards view"
                className={`p-1 rounded-md cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-[#1E3A8A] shadow-2xs' : 'text-slate-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                aria-label="Table view"
                className={`p-1 rounded-md cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-[#1E3A8A] shadow-2xs' : 'text-slate-400'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Courses Display */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 h-52 animate-pulse" />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
            No courses match your filters.
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course) => {
              const isSelected = selectedCourseIds.includes(course.id);
              const isFull = course.available_seats <= 0;
              const seatPercentage =
                course.total_seats > 0
                  ? Math.round((course.available_seats / course.total_seats) * 100)
                  : 0;

              const seatBarColor = isFull
                ? 'bg-red-500'
                : course.available_seats <= 5
                ? 'bg-amber-500'
                : 'bg-emerald-500';

              return (
                <article
                  key={course.id}
                  className={`bg-white rounded-xl border p-4 flex flex-col justify-between ${
                    isSelected ? 'border-[#1E3A8A] ring-1 ring-[#1E3A8A]' : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="font-bold text-[#1E3A8A]">{course.code}</span>
                      <span className="font-semibold text-slate-700">{course.credits} Credits</span>
                    </div>

                    <h2 className="text-sm font-bold text-slate-900">{course.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{course.faculty}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-1 text-[11px]">
                      <span className="text-slate-400">Prereq:</span>
                      {course.prerequisites.length === 0 ? (
                        <span className="text-slate-500">None</span>
                      ) : (
                        course.prerequisites.map((p) => (
                          <span
                            key={p.id}
                            className={`px-1.5 py-0.5 rounded font-mono font-medium ${
                              p.completed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {p.code}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-slate-500">Seats</span>
                        <span className="font-mono font-semibold tabular-nums text-slate-700">
                          {course.available_seats} / {course.total_seats}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${seatBarColor}`} style={{ width: `${seatPercentage}%` }} />
                      </div>
                    </div>

                    {course.isRegistered ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-1.5 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold"
                      >
                        Registered
                      </button>
                    ) : !course.prerequisitesPassed ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-1.5 px-3 rounded-lg bg-slate-100 text-slate-400 text-xs font-medium flex items-center justify-center gap-1 cursor-not-allowed"
                      >
                        <Lock className="w-3 h-3 shrink-0" />
                        <span>Missing {course.missingPrerequisites.map((m) => m.code).join(', ')}</span>
                      </button>
                    ) : isFull ? (
                      course.isWaitlisted ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-1.5 px-3 rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold"
                        >
                          Waitlisted (#{course.waitlistPosition})
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={joiningWaitlistId === course.id}
                          onClick={() => handleJoinWaitlistDirect(course)}
                          className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          {joiningWaitlistId === course.id ? 'Joining...' : 'Join Waiting List'}
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleCourse(course)}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-[#1E3A8A] hover:bg-blue-900 text-white'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Course</th>
                    <th className="py-2.5 px-4">Faculty</th>
                    <th className="py-2.5 px-4 text-right">Credits</th>
                    <th className="py-2.5 px-4">Prerequisites</th>
                    <th className="py-2.5 px-4 text-right">Seats</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCourses.map((course) => {
                    const isSelected = selectedCourseIds.includes(course.id);
                    const isFull = course.available_seats <= 0;

                    return (
                      <tr key={course.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#1E3A8A]">{course.code}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{course.name}</td>
                        <td className="py-2.5 px-4 text-slate-500">{course.faculty}</td>
                        <td className="py-2.5 px-4 text-right font-mono">{course.credits}</td>
                        <td className="py-2.5 px-4">
                          {course.prerequisites.length === 0 ? (
                            <span className="text-slate-400">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {course.prerequisites.map((p) => (
                                <span
                                  key={p.id}
                                  className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${
                                    p.completed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                                  }`}
                                >
                                  {p.code}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {course.available_seats} / {course.total_seats}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {course.isRegistered ? (
                            <span className="text-emerald-700 font-semibold">Registered</span>
                          ) : !course.prerequisitesPassed ? (
                            <span className="text-red-600">
                              Missing {course.missingPrerequisites.map((m) => m.code).join(', ')}
                            </span>
                          ) : isFull ? (
                            course.isWaitlisted ? (
                              <span className="text-amber-700 font-semibold">
                                Waitlisted #{course.waitlistPosition}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleJoinWaitlistDirect(course)}
                                className="px-2.5 py-1 rounded bg-amber-600 text-white font-semibold cursor-pointer"
                              >
                                Join Waiting List
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCourse(course)}
                              className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                                isSelected ? 'bg-emerald-600 text-white' : 'bg-[#1E3A8A] text-white'
                              }`}
                            >
                              {isSelected ? 'Remove' : 'Add'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};
