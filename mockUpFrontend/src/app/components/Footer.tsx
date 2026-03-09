import React from 'react';
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';
import { useLocation } from 'react-router';

export const Footer = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/host');

  if (isDashboard) return null;

  return (
    <footer className="bg-brand-100 border-t border-brand-200 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-24 mb-16">
          <div>
            <span className="text-2xl font-black tracking-tight text-brand-700 mb-6 block">
              SPACE<span className="text-brand-400">BOOK</span>
            </span>
            <p className="text-brand-500 font-medium mb-8 leading-relaxed">
              We connect creative professionals with unique, high-quality spaces to help them bring their visions to life. From lofts to professional studios, discover your perfect workspace today.
            </p>
            <div className="flex gap-4">
              {[Facebook, Twitter, Instagram, Linkedin].map((Icon, idx) => (
                <button key={idx} className="w-10 h-10 bg-white border border-brand-200 text-brand-500 rounded-full flex items-center justify-center hover:bg-brand-500 hover:text-white hover:border-brand-500 transition-all cursor-pointer">
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-brand-700 font-black text-lg mb-8 uppercase tracking-widest">Resources</h4>
            <ul className="space-y-4">
              {['How it works', 'Trust and safety', 'Community', 'Help Center', 'Blog'].map((item, idx) => (
                <li key={idx}>
                  <a href="#" className="text-brand-500 font-medium hover:text-brand-700 transition-colors flex items-center gap-2 group">
                    <span className="w-1.5 h-1.5 bg-brand-200 rounded-full group-hover:bg-brand-400 transition-colors" />
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-brand-700 font-black text-lg mb-8 uppercase tracking-widest">Company</h4>
            <ul className="space-y-4">
              {['About us', 'Careers', 'Terms of service', 'Privacy policy', 'Contact'].map((item, idx) => (
                <li key={idx}>
                  <a href="#" className="text-brand-500 font-medium hover:text-brand-700 transition-colors flex items-center gap-2 group">
                    <span className="w-1.5 h-1.5 bg-brand-200 rounded-full group-hover:bg-brand-400 transition-colors" />
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-brand-700 font-black text-lg mb-8 uppercase tracking-widest">Contact</h4>
            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white border border-brand-200 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-brand-400" />
                </div>
                <p className="text-brand-500 font-medium leading-tight">123 Creative Way, <br />Suite 500, NYC</p>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white border border-brand-200 rounded-xl flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-brand-400" />
                </div>
                <p className="text-brand-500 font-medium leading-tight">hello@spacebook.com</p>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white border border-brand-200 rounded-xl flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-brand-400" />
                </div>
                <p className="text-brand-500 font-medium leading-tight">+1 (555) 000-SPACE</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-10 border-t border-brand-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-brand-400 text-sm font-medium">© 2026 SpaceBook Inc. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="text-brand-400 text-sm font-medium hover:text-brand-700 transition-colors">English (US)</a>
            <a href="#" className="text-brand-400 text-sm font-medium hover:text-brand-700 transition-colors">USD ($)</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
