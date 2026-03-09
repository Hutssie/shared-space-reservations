import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Search,
  Edit3,
  Calendar,
  Star,
  ExternalLink,
} from 'lucide-react';
import { NotificationBadge } from './NotificationBadge';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { fetchHostSpaces } from '../api/host';
import type { HostListing } from '../api/host';

type ListingRow = {
  id: string;
  title: string;
  category: string;
  price: number;
  image: string | null;
  bookings: number;
  rating: number | null;
  status: string;
  lastUpdated: string;
  unseenBookingsCount: number;
};

export const ManageListings = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<ListingRow[]>([]);

  useEffect(() => {
    fetchHostSpaces().then((data) =>
      setListings(
        data.map((s) => ({
          id: s.id,
          title: s.title,
          category: s.category,
          price: s.price,
          image: s.image,
          bookings: (s as HostListing).bookings ?? 0,
          rating: s.rating,
          status: (s as HostListing).status ?? 'Active',
          lastUpdated: '—',
          unseenBookingsCount: (s as HostListing).unseenBookingsCount ?? 0,
        }))
      )
    ).catch(() => setListings([]));
  }, []);

  const filteredListings = listings.filter(l => 
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="space-y-2">
            <Link 
              to="/host" 
              className="flex items-center gap-2 text-brand-400 hover:text-brand-700 transition-colors font-black uppercase tracking-widest text-[10px] md:text-xs mb-4 group"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl md:text-5xl font-black text-brand-700 tracking-tight">Manage Listings</h1>
            <p className="text-brand-500 font-medium text-lg">Update your spaces and manage bookings per listing.</p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-6 border border-brand-200 shadow-xl shadow-brand-700/5 mb-10 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-300" />
            <input 
              type="text" 
              placeholder="Search your listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-brand-50 border-none rounded-2xl focus:ring-2 focus:ring-brand-400 focus:outline-none font-bold text-brand-700 placeholder:text-brand-300"
            />
          </div>
        </div>

        {/* Content Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
        >
          {filteredListings.map((listing) => (
                <div 
                  key={listing.id}
                  className="bg-white rounded-[2rem] border border-brand-100 shadow-xl shadow-brand-700/5 overflow-hidden group hover:border-brand-300 hover:shadow-2xl transition-all duration-500"
                >
                  <Link to={`/host/manage-listings/edit/${listing.id}`} className="relative overflow-hidden block aspect-[4/3]">
                    <ImageWithFallback src={listing.image} alt={listing.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md shadow-lg ${
                        listing.status === 'Active' ? 'bg-white/90 text-brand-700' : 'bg-brand-900/90 text-white'
                      }`}>
                        {listing.status}
                      </span>
                    </div>
                    <div className="absolute top-4 right-4">
                      <NotificationBadge count={listing.unseenBookingsCount} />
                    </div>
                  </Link>
                  
                  <div className="p-6 md:p-8 flex flex-col flex-1 min-w-0">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">{listing.category}</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-brand-500 fill-brand-500" />
                          <span className="text-xs font-black text-brand-700">{listing.rating ?? '-'}</span>
                        </div>
                      </div>
                      <Link to={`/host/manage-listings/edit/${listing.id}`} className="block w-fit hover:text-brand-500 transition-colors">
                        <h3 className="text-xl md:text-2xl font-black text-brand-700 truncate">{listing.title}</h3>
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-4 my-6 py-4 border-y border-brand-50">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-brand-300 uppercase">Price</p>
                        <p className="text-lg font-black text-brand-700">${listing.price}<span className="text-xs text-brand-400">/hr</span></p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-brand-300 uppercase">Total Bookings</p>
                        <p className="text-lg font-black text-brand-700">{listing.bookings}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        to={`/host/manage-listings/edit/${listing.id}`}
                        className="flex-1 min-w-[100px] py-3 px-5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-xl transition-all cursor-pointer font-black text-sm flex items-center justify-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </Link>
                      <Link
                        to={`/space/${listing.id}`}
                        className="flex-1 min-w-[100px] py-3 px-5 bg-brand-100 hover:bg-brand-200 text-brand-700 font-black text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View
                      </Link>
                      <Link
                        to={`/host/manage-listings/${listing.id}/bookings`}
                        className="flex-1 min-w-[120px] py-3 px-5 bg-brand-700 hover:bg-brand-600 text-white font-black text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-brand-700/20"
                      >
                        <Calendar className="w-4 h-4" />
                        Bookings
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
        </motion.div>
      </div>
    </div>
  );
};
