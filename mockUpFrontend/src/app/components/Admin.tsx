import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  Star,
  ArrowLeft,
  Shield,
  Search,
  ChevronRight,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminUser,
  fetchAdminSpaces,
  updateSpaceStatus,
  fetchAdminBookings,
  fetchAdminReviews,
  deleteAdminReview,
  banAdminUser,
  unbanAdminUser,
  type AdminStats as AdminStatsType,
  type AdminUser as AdminUserType,
  type AdminUserDetail,
  type AdminSpace,
  type AdminBooking,
  type AdminReview,
} from '../api/admin';
import { toast } from 'sonner';

const TABS = [
  { id: 'stats', label: 'Stats', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'spaces', label: 'Spaces', icon: Building2 },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'reviews', label: 'Reviews', icon: Star },
] as const;

type TabId = (typeof TABS)[number]['id'];

const LIMIT = 20;

export const Admin = () => {
  const [tab, setTab] = useState<TabId>('stats');
  const [stats, setStats] = useState<AdminStatsType | null>(null);
  const [users, setUsers] = useState<AdminUserType[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');
  const [spaces, setSpaces] = useState<AdminSpace[]>([]);
  const [spacesTotal, setSpacesTotal] = useState(0);
  const [spacesOffset, setSpacesOffset] = useState(0);
  const [spacesStatusFilter, setSpacesStatusFilter] = useState<string>('');
  const [spacesSearch, setSpacesSearch] = useState('');
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsOffset, setBookingsOffset] = useState(0);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsOffset, setReviewsOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);

  const handleBanUser = async (u: AdminUserType) => {
    if (u.role === 'admin') return;
    if (!window.confirm('Are you sure? This will suspend all their listings and cancel future bookings. Guests with bookings at their spaces will be notified.')) return;
    try {
      const updated = await banAdminUser(u.id);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, bannedAt: updated.bannedAt } : x)));
      if (selectedUserId === u.id) fetchAdminUser(u.id).then(setUserDetail).catch(() => setUserDetail(null));
      toast.success('User banned');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to ban user');
    }
  };

  const handleUnbanUser = async (u: AdminUserType) => {
    try {
      const updated = await unbanAdminUser(u.id);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, bannedAt: updated.bannedAt } : x)));
      if (selectedUserId === u.id) fetchAdminUser(u.id).then(setUserDetail).catch(() => setUserDetail(null));
      toast.success('User unbanned');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to unban user');
    }
  };

  useEffect(() => {
    if (tab === 'stats') {
      setLoading(true);
      fetchAdminStats()
        .then(setStats)
        .catch(() => toast.error('Failed to load stats'))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'users') {
      setLoading(true);
      fetchAdminUsers({ q: usersSearch || undefined, limit: LIMIT, offset: usersOffset })
        .then(({ users: u, total }) => {
          setUsers(u);
          setUsersTotal(total);
        })
        .catch(() => toast.error('Failed to load users'))
        .finally(() => setLoading(false));
    }
  }, [tab, usersOffset, usersSearch]);

  useEffect(() => {
    if (tab === 'spaces') {
      setLoading(true);
      fetchAdminSpaces({ status: spacesStatusFilter || undefined, q: spacesSearch || undefined, limit: LIMIT, offset: spacesOffset })
        .then(({ spaces: s, total }) => {
          setSpaces(s);
          setSpacesTotal(total);
        })
        .catch(() => toast.error('Failed to load spaces'))
        .finally(() => setLoading(false));
    }
  }, [tab, spacesOffset, spacesStatusFilter, spacesSearch]);

  useEffect(() => {
    if (tab === 'bookings') {
      setLoading(true);
      fetchAdminBookings({ limit: LIMIT, offset: bookingsOffset })
        .then(({ bookings: b, total }) => {
          setBookings(b);
          setBookingsTotal(total);
        })
        .catch(() => toast.error('Failed to load bookings'))
        .finally(() => setLoading(false));
    }
  }, [tab, bookingsOffset]);

  useEffect(() => {
    if (tab === 'reviews') {
      setLoading(true);
      fetchAdminReviews({ limit: LIMIT, offset: reviewsOffset })
        .then(({ reviews: r, total }) => {
          setReviews(r);
          setReviewsTotal(total);
        })
        .catch(() => toast.error('Failed to load reviews'))
        .finally(() => setLoading(false));
    }
  }, [tab, reviewsOffset]);

  useEffect(() => {
    if (selectedUserId) {
      fetchAdminUser(selectedUserId)
        .then(setUserDetail)
        .catch(() => toast.error('Failed to load user'));
    } else {
      setUserDetail(null);
    }
  }, [selectedUserId]);

  const handleSpaceStatus = async (id: string, status: string) => {
    try {
      await updateSpaceStatus(id, status);
      toast.success('Space updated');
      setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleDeleteReview = async (id: string) => {
    try {
      await deleteAdminReview(id);
      toast.success('Review deleted');
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setReviewsTotal((n) => Math.max(0, n - 1));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  return (
    <div className="min-h-screen bg-brand-50/30 pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="p-2 rounded-xl bg-white border border-brand-100 hover:border-brand-200 transition-colors">
            <ArrowLeft className="w-5 h-5 text-brand-700" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-brand-700">Admin</h1>
              <p className="text-brand-500 font-medium text-sm">Platform overview and moderation</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <nav className="flex md:flex-col gap-2 shrink-0 md:w-56">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setTab(id); setSelectedUserId(null); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-left transition-colors ${
                  tab === id ? 'bg-brand-700 text-white' : 'bg-white border border-brand-100 text-brand-700 hover:bg-brand-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0">
            {loading && tab !== 'stats' && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
              </div>
            )}

            {tab === 'stats' && (
              <div className="space-y-6">
                {loading ? (
                  <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 text-brand-400 animate-spin" /></div>
                ) : stats ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Users" value={stats.users} />
                    <StatCard label="Spaces (active)" value={stats.spacesActive} sub={`/ ${stats.spaces}`} />
                    <StatCard label="Bookings" value={stats.bookings} sub={`${stats.bookingsConfirmed} confirmed, ${stats.bookingsPending} pending`} />
                    <StatCard label="Reviews" value={stats.reviews} />
                    <StatCard label="Cities" value={stats.cities} className="col-span-2 md:col-span-4" />
                  </div>
                ) : null}
              </div>
            )}

            {tab === 'users' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={usersSearch}
                      onChange={(e) => { setUsersSearch(e.target.value); setUsersOffset(0); }}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-100 rounded-xl font-medium text-brand-700"
                    />
                  </div>
                </div>
                {loading ? (
                  <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 text-brand-400 animate-spin" /></div>
                ) : (
                <>
                <div className="bg-white rounded-2xl border border-brand-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-brand-100 bg-brand-50/50">
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Email</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Name</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Role</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Status</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Created</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-brand-50 hover:bg-brand-50/30">
                          <td className="px-4 py-3 font-medium text-brand-700">{u.email}</td>
                          <td className="px-4 py-3 text-brand-700">{u.name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${u.role === 'admin' ? 'bg-brand-200 text-brand-800' : 'bg-brand-100 text-brand-600'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {u.bannedAt ? (
                              <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-red-100 text-red-800">Banned</span>
                            ) : (
                              <span className="text-brand-500 text-sm">Active</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-brand-500 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(u.id)}
                              className="text-brand-500 hover:text-brand-700 font-bold text-sm flex items-center gap-1"
                            >
                              View <ChevronRight className="w-4 h-4" />
                            </button>
                            {u.role !== 'admin' && (
                              u.bannedAt ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnbanUser(u)}
                                  className="text-green-600 hover:text-green-700 font-bold text-sm"
                                >
                                  Unban
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleBanUser(u)}
                                  className="text-red-600 hover:text-red-700 font-bold text-sm"
                                >
                                  Ban
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {usersTotal > LIMIT && (
                  <div className="flex justify-between items-center">
                    <p className="text-brand-500 text-sm">Showing {usersOffset + 1}-{Math.min(usersOffset + LIMIT, usersTotal)} of {usersTotal}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={usersOffset === 0}
                        onClick={() => setUsersOffset((o) => Math.max(0, o - LIMIT))}
                        className="px-4 py-2 rounded-lg border border-brand-200 font-bold text-brand-700 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={usersOffset + LIMIT >= usersTotal}
                        onClick={() => setUsersOffset((o) => o + LIMIT)}
                        className="px-4 py-2 rounded-lg border border-brand-200 font-bold text-brand-700 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
                {selectedUserId && userDetail && (
                  <div className="mt-6 p-6 bg-white rounded-2xl border border-brand-100">
                    <h3 className="text-lg font-black text-brand-700 mb-4">User detail</h3>
                    <p className="text-brand-700 font-medium">{userDetail.name} ({userDetail.email})</p>
                    {userDetail.bannedAt && (
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-lg text-xs font-bold bg-red-100 text-red-800">Banned</span>
                    )}
                    <p className="text-brand-500 text-sm mt-2">Spaces: {userDetail.spacesCount} · Bookings: {userDetail.bookingsCount} · Reviews: {userDetail.reviewsCount}</p>
                    {userDetail.role !== 'admin' && (
                      <div className="mt-3 flex gap-2">
                        {userDetail.bannedAt ? (
                          <button type="button" onClick={() => handleUnbanUser(userDetail)} className="text-green-600 hover:text-green-700 font-bold text-sm">Unban</button>
                        ) : (
                          <button type="button" onClick={() => handleBanUser(userDetail)} className="text-red-600 hover:text-red-700 font-bold text-sm">Ban</button>
                        )}
                      </div>
                    )}
                    <button type="button" onClick={() => setSelectedUserId(null)} className="mt-4 text-brand-500 font-bold text-sm hover:underline">Close</button>
                  </div>
                )}
                </>
                )}
              </div>
            )}

            {tab === 'spaces' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                    <input
                      type="text"
                      placeholder="Search by space name..."
                      value={spacesSearch}
                      onChange={(e) => { setSpacesSearch(e.target.value); setSpacesOffset(0); }}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-100 rounded-xl font-medium text-brand-700"
                    />
                  </div>
                  <select
                    value={spacesStatusFilter}
                    onChange={(e) => { setSpacesStatusFilter(e.target.value); setSpacesOffset(0); }}
                    className="px-4 py-2.5 bg-white border border-brand-100 rounded-xl font-medium text-brand-700"
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                {loading ? (
                  <div className="flex justify-center py-12"><RefreshCw className="w-8 h-8 text-brand-400 animate-spin" /></div>
                ) : (
                <>
                <div className="bg-white rounded-2xl border border-brand-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-brand-100 bg-brand-50/50">
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Title</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Host</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Location</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Status</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spaces.map((s) => (
                        <tr key={s.id} className="border-b border-brand-50 hover:bg-brand-50/30">
                          <td className="px-4 py-3 font-medium text-brand-700">{s.title}</td>
                          <td className="px-4 py-3 text-brand-700">{s.host?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-brand-600 text-sm">{s.location}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                              s.status === 'active' ? 'bg-green-100 text-green-800' :
                              s.status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-brand-100 text-brand-600'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 flex gap-2">
                            {s.status !== 'active' && (
                              <button type="button" onClick={() => handleSpaceStatus(s.id, 'active')} className="text-green-600 font-bold text-xs hover:underline">Activate</button>
                            )}
                            {s.status !== 'suspended' && (
                              <button type="button" onClick={() => handleSpaceStatus(s.id, 'suspended')} className="text-red-600 font-bold text-xs hover:underline">Suspend</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {spacesTotal > LIMIT && (
                  <div className="flex justify-between items-center">
                    <p className="text-brand-500 text-sm">Showing {spacesOffset + 1}-{Math.min(spacesOffset + LIMIT, spacesTotal)} of {spacesTotal}</p>
                    <div className="flex gap-2">
                      <button type="button" disabled={spacesOffset === 0} onClick={() => setSpacesOffset((o) => Math.max(0, o - LIMIT))} className="px-4 py-2 rounded-lg border border-brand-200 font-bold text-brand-700 disabled:opacity-50">Previous</button>
                      <button type="button" disabled={spacesOffset + LIMIT >= spacesTotal} onClick={() => setSpacesOffset((o) => o + LIMIT)} className="px-4 py-2 rounded-lg border border-brand-200 font-bold text-brand-700 disabled:opacity-50">Next                      </button>
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
            )}

            {tab === 'bookings' && !loading && (
              <div className="bg-white rounded-2xl border border-brand-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-brand-100 bg-brand-50/50">
                      <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Guest</th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Space</th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Date</th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Time</th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Status</th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id} className="border-b border-brand-50 hover:bg-brand-50/30">
                        <td className="px-4 py-3 font-medium text-brand-700">{b.user.name}</td>
                        <td className="px-4 py-3 text-brand-700">{b.space.title}</td>
                        <td className="px-4 py-3 text-brand-600 text-sm">{b.date}</td>
                        <td className="px-4 py-3 text-brand-600 text-sm">{b.startTime} – {b.endTime}</td>
                        <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-brand-100 text-brand-600">{b.status}</span></td>
                        <td className="px-4 py-3 font-bold text-brand-700">${b.totalPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bookingsTotal > LIMIT && (
                  <div className="flex justify-between items-center p-4 border-t border-brand-100">
                    <p className="text-brand-500 text-sm">Showing {bookingsOffset + 1}-{Math.min(bookingsOffset + LIMIT, bookingsTotal)} of {bookingsTotal}</p>
                    <div className="flex gap-2">
                      <button type="button" disabled={bookingsOffset === 0} onClick={() => setBookingsOffset((o) => Math.max(0, o - LIMIT))} className="px-4 py-2 rounded-lg border border-brand-200 font-bold text-brand-700 disabled:opacity-50">Previous</button>
                      <button type="button" disabled={bookingsOffset + LIMIT >= bookingsTotal} onClick={() => setBookingsOffset((o) => o + LIMIT)} className="px-4 py-2 rounded-lg border border-brand-200 font-bold text-brand-700 disabled:opacity-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'reviews' && !loading && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-brand-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-brand-100 bg-brand-50/50">
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Space</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">User</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Rating</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Text</th>
                        <th className="px-4 py-3 text-xs font-black uppercase text-brand-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((r) => (
                        <tr key={r.id} className="border-b border-brand-50 hover:bg-brand-50/30">
                          <td className="px-4 py-3 font-medium text-brand-700">{r.space.title}</td>
                          <td className="px-4 py-3 text-brand-700">{r.user.name}</td>
                          <td className="px-4 py-3 font-bold text-brand-700">{r.rating}</td>
                          <td className="px-4 py-3 text-brand-600 text-sm max-w-xs truncate">{r.text}</td>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => handleDeleteReview(r.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete review">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {reviewsTotal > LIMIT && (
                  <div className="flex justify-between items-center">
                    <p className="text-brand-500 text-sm">Showing {reviewsOffset + 1}-{Math.min(reviewsOffset + LIMIT, reviewsTotal)} of {reviewsTotal}</p>
                    <div className="flex gap-2">
                      <button type="button" disabled={reviewsOffset === 0} onClick={() => setReviewsOffset((o) => Math.max(0, o - LIMIT))} className="px-4 py-2 rounded-lg border border-brand-200 font-bold text-brand-700 disabled:opacity-50">Previous</button>
                      <button type="button" disabled={reviewsOffset + LIMIT >= reviewsTotal} onClick={() => setReviewsOffset((o) => o + LIMIT)} className="px-4 py-2 rounded-lg border border-brand-200 font-bold text-brand-700 disabled:opacity-50">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function StatCard({ label, value, sub, className = '' }: { label: string; value: number; sub?: string; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-brand-100 p-6 ${className}`}>
      <p className="text-brand-500 font-bold text-sm uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-brand-700 mt-1">{value}</p>
      {sub && <p className="text-brand-400 text-xs mt-1">{sub}</p>}
    </div>
  );
}
