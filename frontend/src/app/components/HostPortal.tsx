import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  TrendingUp,
  ChevronRight,
  Star,
  Users,
  DollarSign,
  LayoutGrid,
  CalendarDays,
  ChevronLeft,
} from 'lucide-react';
import { NotificationBadge } from './NotificationBadge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Link } from 'react-router';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { fetchHostSpaces, fetchHostBookings } from '../api/host';
import type { HostListing, HostBooking } from '../api/host';
import { useAuth } from '../context/AuthContext';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const HostPortal = () => {
  const { user } = useAuth();
  const [isMounted, setIsMounted] = React.useState(false);
  const [chartView, setChartView] = React.useState<'weekly' | 'monthly'>('weekly');
  const [listings, setListings] = useState<HostListing[]>([]);
  const [bookings, setBookings] = useState<HostBooking[]>([]);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    fetchHostSpaces()
      .then(setListings)
      .catch(() => setListings([]));
  }, []);

  useEffect(() => {
    fetchHostBookings()
      .then(setBookings)
      .catch(() => setBookings([]));
  }, []);

  const stats = useMemo(() => {
    const totalRevenue = listings.reduce((sum, l) => sum + (l.revenue ?? 0), 0);
    const activeBookings = bookings.filter((b) => b.status === 'confirmed').length;
    const ratingsWithValues = listings.filter((l) => l.rating != null) as { rating: number }[];
    const avgRating = ratingsWithValues.length > 0
      ? (ratingsWithValues.reduce((s, l) => s + l.rating, 0) / ratingsWithValues.length).toFixed(2)
      : '-';
    const uniqueGuestIds = new Set(bookings.map((b) => b.guestId ?? b.guest).filter(Boolean));
    const uniqueGuests = uniqueGuestIds.size;

    return [
      { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'bg-green-100 text-green-700' },
      { label: 'Active Bookings', value: String(activeBookings), icon: CalendarDays, color: 'bg-blue-100 text-blue-700' },
      { label: 'Avg. Rating', value: String(avgRating), icon: Star, color: 'bg-yellow-100 text-yellow-700' },
      { label: 'Unique Guests', value: String(uniqueGuests), icon: Users, color: 'bg-purple-100 text-purple-700' },
    ];
  }, [listings, bookings]);

  const { weeklyData, monthlyData } = useMemo(() => {
    const now = new Date();
    const confirmed = bookings.filter((b) => b.status === 'confirmed');

    const weeklyData: { name: string; revenue: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const dateStr = toLocalDateStr(d);
      const revenue = confirmed
        .filter((b) => b.date === dateStr)
        .reduce((sum, b) => sum + b.totalPrice, 0);
      weeklyData.push({ name: DAY_NAMES[d.getDay()], revenue });
    }

    const monthlyData: { name: string; revenue: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const revenue = confirmed
        .filter((b) => b.date.startsWith(monthKey))
        .reduce((sum, b) => sum + b.totalPrice, 0);
      monthlyData.push({ name: MONTH_LABELS[d.getMonth()], revenue });
    }

    return { weeklyData, monthlyData };
  }, [bookings]);

  const chartData = chartView === 'weekly' ? weeklyData : monthlyData;

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div>
            <h1 className="text-4xl font-black text-brand-700 tracking-tight">Host Dashboard</h1>
            <p className="text-brand-500 font-medium text-lg mt-2">Welcome back{user?.name?.trim() ? `, ${user.name.trim().split(/\s+/)[0]}` : ''}.</p>
          </div>
          <Link
            to="/list-your-space"
            className="flex items-center gap-3 px-10 py-4.5 bg-brand-700 hover:bg-brand-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-brand-700/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-6 h-6" />
            Create New Listing
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 mb-12">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-brand-200 shadow-xl shadow-brand-700/5 hover:shadow-2xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 md:w-14 md:h-14 ${stat.color} rounded-xl md:rounded-2xl flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 md:w-7 md:h-7" />
                </div>
              </div>
              <h4 className="text-xl md:text-3xl font-black text-brand-700">{stat.value}</h4>
              <p className="text-brand-400 font-bold uppercase tracking-[0.2em] text-[8px] md:text-[10px] mt-2">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_450px] gap-8 md:gap-12 lg:h-[600px] xl:h-[700px]">
          {/* Chart Section */}
          <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-brand-200 shadow-xl shadow-brand-700/5 flex flex-col min-h-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 md:mb-10 gap-4">
              <div>
                <h3 className="text-xl md:text-2xl font-black text-brand-700">Revenue Performance</h3>
                <p className="text-xs md:text-sm text-brand-400 font-medium mt-1">
                  {chartView === 'weekly' ? 'Last 7 days' : 'Last 6 months'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className={`px-4 py-2 ${chartView === 'weekly' ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-500'} text-xs font-bold rounded-xl cursor-pointer transition-colors hover:bg-brand-100`}
                  onClick={() => setChartView('weekly')}
                >
                  Weekly
                </button>
                <button
                  className={`px-4 py-2 ${chartView === 'monthly' ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-500'} text-xs font-bold rounded-xl hover:bg-brand-100 cursor-pointer transition-colors`}
                  onClick={() => setChartView('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>
            <div className="h-[300px] md:h-[400px] w-full relative shrink-0">
              <div className="absolute inset-0 w-full h-full">
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#170f08" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#170f08" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f2ddce" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8c7a6b', fontSize: 10, fontWeight: 700 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8c7a6b', fontSize: 10, fontWeight: 700 }} dx={-10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#170f08', border: 'none', borderRadius: '16px', color: 'white' }}
                        itemStyle={{ color: '#f2ddce', fontWeight: 800 }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#170f08" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full bg-brand-50/50 rounded-2xl animate-pulse flex items-center justify-center">
                    <span className="text-brand-300 font-bold uppercase tracking-widest text-xs">Loading Analytics...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Listing Performance */}
          <div className="min-w-0 min-h-0 flex flex-col">
            <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-brand-200 shadow-xl shadow-brand-700/5 flex flex-col flex-1 min-h-0">
              <h3 className="text-xl md:text-2xl font-black text-brand-700 mb-6 md:mb-8 shrink-0">My Listings</h3>
              <div className="space-y-4 md:space-y-6 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
                {listings.map((listing) => (
                  <Link key={listing.id} to={`/host/manage-listings/edit/${listing.id}`} className="flex items-center gap-4 md:gap-6 p-3 md:p-4 rounded-[1.5rem] md:rounded-[2rem] hover:bg-brand-50 transition-all border border-transparent hover:border-brand-200 group cursor-pointer">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl overflow-hidden shrink-0 shadow-lg">
                      <ImageWithFallback src={listing.image ?? ''} alt={listing.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base md:text-lg font-black text-brand-700 truncate">{listing.title}</h4>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-[10px] md:text-xs font-black text-brand-400 uppercase tracking-widest">{listing.bookings ?? 0} bookings</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-brand-500 fill-brand-500" />
                          <span className="text-[10px] md:text-xs font-black text-brand-700">{listing.rating ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base md:text-lg font-black text-brand-700">${listing.revenue ?? 0}</p>
                      <span className="text-[9px] md:text-[10px] font-black text-green-600 uppercase tracking-[0.2em]">Paid</span>
                    </div>
                  </Link>
                ))}
              </div>
              <Link 
                to="/host/manage-listings"
                className="w-full mt-8 md:mt-10 py-4 md:py-5 border-2 border-brand-100 hover:border-brand-700 text-brand-700 font-black rounded-2xl transition-all cursor-pointer text-center block relative shrink-0"
              >
                Manage All Listings
                {listings.reduce((sum, l) => sum + (l.unseenBookingsCount ?? 0), 0) > 0 && (
                  <NotificationBadge
                    count={listings.reduce((sum, l) => sum + (l.unseenBookingsCount ?? 0), 0)}
                    className="absolute -top-2 -right-2"
                  />
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
