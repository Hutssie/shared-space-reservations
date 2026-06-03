import React from 'react';
import { Search, CalendarCheck, DoorOpen } from 'lucide-react';

const steps = [
  {
    icon: Search,
    title: 'Find your perfect space',
    description: 'Explore thousands of unique locations across the country. Filter by price, capacity, and equipment to find your match.'
  },
  {
    icon: CalendarCheck,
    title: 'Book and pay securely',
    description: 'Connect with hosts and confirm your booking instantly. All payments are handled securely through our platform.'
  },
  {
    icon: DoorOpen,
    title: 'Arrive and create',
    description: 'Access the space at your scheduled time and get straight to work. Our hosts make sure everything is ready for your success.'
  }
];

export const HowItWorks = () => {
  return (
    <section className="py-20 bg-brand-700 text-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-200 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-400 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">How <span className="text-brand-200 underline decoration-brand-200 underline-offset-6">SpaceBook</span> works</h2>
          <p className="text-brand-100/70 max-w-xl mx-auto text-base font-medium">Three simple steps to unlock your creativity in the best professional environments available today.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16 relative">
          <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-0.5 border-t-2 border-dashed border-white/20 z-0" />
          
          {steps.map((step, idx) => (
            <div key={idx} className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-500 transition-all duration-500 group-hover:rotate-6 shadow-2xl">
                <step.icon className="w-8 h-8 text-brand-200 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-lg font-bold mb-3">{step.title}</h3>
              <p className="text-brand-100/60 text-sm leading-relaxed font-medium">{step.description}</p>
              
              <div className="mt-6 flex items-center justify-center w-9 h-9 bg-brand-600 rounded-full border border-white/10 text-sm font-bold">
                {idx + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
