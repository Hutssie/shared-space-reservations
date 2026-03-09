import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Users, 
  Music, 
  Palette, 
  Dumbbell, 
  GraduationCap, 
  Monitor, 
  FlaskConical, 
  Mic, 
  Coffee 
} from 'lucide-react';
import { Link } from 'react-router';
import { fetchCategoryCounts } from '../api/spaces';

const categories = [
  { icon: Palette, name: 'Art Studio' },
  { icon: Dumbbell, name: 'Sports Space' },
  { icon: GraduationCap, name: 'Classroom' },
  { icon: Users, name: 'Conference Room' },
  { icon: Monitor, name: 'IT Classroom' },
  { icon: FlaskConical, name: 'Laboratory' },
  { icon: Camera, name: 'Photo Studio' },
  { icon: Mic, name: 'Recording Studio' },
  { icon: Coffee, name: 'Kitchen Studio' },
  { icon: Music, name: 'Dancing Studio' },
];

export const Categories = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchCategoryCounts()
      .then(setCounts)
      .catch(() => setCounts({}));
  }, []);

  return (
    <section className="py-20 bg-brand-100/50 overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-brand-700 mb-6 tracking-tight">Browse by category</h2>
          <p className="text-brand-500 font-medium max-w-2xl mx-auto text-lg">
            From specialized technical labs to inspiring creative lofts, find the exact environment you need.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {categories.map((cat, idx) => (
            <Link 
              key={idx} 
              to={`/find?category=${encodeURIComponent(cat.name)}`}
              className="group flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-brand-200 hover:border-brand-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm cursor-pointer no-underline"
            >
              <div className="w-12 h-12 bg-brand-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-brand-500 transition-colors">
                <cat.icon className="w-6 h-6 text-brand-500 group-hover:text-white transition-colors" />
              </div>
              <span className="text-sm font-bold text-brand-700 mb-1 group-hover:text-brand-500 transition-colors text-center">{cat.name}</span>
              <span className="text-xs text-brand-400 font-medium group-hover:text-brand-400 transition-colors">{counts[cat.name] ?? 0} spaces</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
