import React from 'react';
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';
import { useLocation } from 'react-router';

export const Footer = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/host');

  if (isDashboard) return null;

  return (
    <footer className="bg-brand-100 border-t border-brand-200 py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-16 mb-12">
          <div>
            <span className="text-xl font-black tracking-tight text-brand-700 mb-4 block">
              SPACE<span className="text-brand-400">BOOK</span>
            </span>
            <p className="text-brand-500 text-sm font-medium mb-6 leading-relaxed">
              We connect creative professionals with unique, high-quality spaces to help them bring their visions to life. From lofts to professional studios, discover your perfect workspace today.
            </p>
            <div className="flex gap-3">
              {[Facebook, Twitter, Instagram, Linkedin].map((Icon, idx) => (
                <button key={idx} type="button" className="w-9 h-9 bg-white border border-brand-200 text-brand-500 rounded-full flex items-center justify-center hover:bg-brand-500 hover:text-white hover:border-brand-500 transition-all cursor-pointer">
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-brand-700 font-black text-base mb-6 uppercase tracking-widest">Resources</h4>
            <ul className="space-y-3">
              {['How it works', 'Trust and safety', 'Community', 'Help Center', 'Blog'].map((item, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    className="text-brand-500 text-sm font-medium hover:text-brand-700 transition-colors flex items-center gap-2 group bg-transparent border-0 p-0 cursor-default"
                  >
                    <span className="w-1.5 h-1.5 bg-brand-200 rounded-full group-hover:bg-brand-400 transition-colors" />
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-brand-700 font-black text-base mb-6 uppercase tracking-widest">Company</h4>
            <ul className="space-y-3">
              {['About us', 'Careers', 'Terms of service', 'Privacy policy', 'Contact'].map((item, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    className="text-brand-500 text-sm font-medium hover:text-brand-700 transition-colors flex items-center gap-2 group bg-transparent border-0 p-0 cursor-default"
                  >
                    <span className="w-1.5 h-1.5 bg-brand-200 rounded-full group-hover:bg-brand-400 transition-colors" />
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-brand-700 font-black text-base mb-6 uppercase tracking-widest">Contact</h4>
            <ul className="space-y-5">
              <li className="flex items-start gap-3">
                <div className="w-9 h-9 bg-white border border-brand-200 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-brand-400" />
                </div>
                <p className="text-brand-500 text-sm font-medium leading-tight">123 Creative Way, <br />Suite 500, NYC</p>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white border border-brand-200 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-brand-400" />
                </div>
                <p className="text-brand-500 text-sm font-medium leading-tight">hello@spacebook.com</p>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white border border-brand-200 rounded-lg flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-brand-400" />
                </div>
                <p className="text-brand-500 text-sm font-medium leading-tight">+1 (555) 000-SPACE</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-brand-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-brand-400 text-xs font-medium">© 2026 SpaceBook Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <button type="button" className="text-brand-400 text-xs font-medium hover:text-brand-700 transition-colors bg-transparent border-0 p-0 cursor-default">English (US)</button>
            <button type="button" className="text-brand-400 text-xs font-medium hover:text-brand-700 transition-colors bg-transparent border-0 p-0 cursor-default">USD ($)</button>
          </div>
        </div>
      </div>
    </footer>
  );
};
