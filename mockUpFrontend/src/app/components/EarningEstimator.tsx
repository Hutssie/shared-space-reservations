import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, Calendar, Info, ArrowRight, CheckCircle2, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from './figma/ImageWithFallback';

export const EarningEstimator = () => {
  const navigate = useNavigate();
  const [spaceType, setSpaceType] = useState('Photo Studio');
  const [hourlyRate, setHourlyRate] = useState(75);
  const [hoursPerWeek, setHoursPerWeek] = useState(15);
  
  const weeklyEarnings = hourlyRate * hoursPerWeek;
  const monthlyEarnings = weeklyEarnings * 4.3;
  const yearlyEarnings = monthlyEarnings * 12;

  const spaceTypes = [
    { name: 'Art Studio', avgRate: 60 },
    { name: 'Sports Space', avgRate: 85 },
    { name: 'Classroom', avgRate: 50 },
    { name: 'Conference Room', avgRate: 120 },
    { name: 'IT Classroom', avgRate: 95 },
    { name: 'Laboratory', avgRate: 150 },
    { name: 'Photo Studio', avgRate: 75 },
    { name: 'Recording Studio', avgRate: 80 },
    { name: 'Kitchen Studio', avgRate: 110 },
    { name: 'Dancing Studio', avgRate: 70 },
  ];

  const handleSpaceTypeChange = (type: string, rate: number) => {
    setSpaceType(type);
    setHourlyRate(rate);
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-48 pb-32 bg-brand-700 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20">
          <ImageWithFallback 
            src="https://images.unsplash.com/photo-1727956886447-bff44e37d126?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjcmVhdGl2ZSUyMHN0dWRpbyUyMHN1bmxpZ2h0JTIwYXJjaGl0ZWN0dXJhbCUyMHBob3RvZ3JhcGh5fGVufDF8fHx8MTc3MTQwNDQzN3ww&ixlib=rb-4.1.0&q=80&w=1920" 
            alt="Studio atmosphere" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-1 bg-brand-200 text-brand-700 rounded-full text-xs font-black uppercase tracking-widest mb-6"
          >
            Profitability Calculator
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-white mb-8 leading-tight"
          >
            Turn your space into <br />
            <span className="text-brand-200">passive income.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-brand-100 text-lg md:text-xl font-medium max-w-2xl mx-auto mb-12"
          >
            Calculate your potential earnings based on market data from thousands of successful hosts on our platform.
          </motion.p>
        </div>
      </section>

      {/* Calculator Section */}
      <section className="relative -mt-20 pb-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Controls */}
            <div className="lg:col-span-7 bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl border border-brand-100">
              <h2 className="text-2xl font-black text-brand-700 mb-8 flex items-center gap-3">
                <Calculator className="w-6 h-6 text-brand-500" />
                Customize your estimate
              </h2>

              <div className="space-y-10">
                {/* Space Type */}
                <div>
                  <label className="block text-xs font-black text-brand-400 uppercase tracking-widest mb-4">Space Category</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {spaceTypes.map((type) => (
                      <button
                        key={type.name}
                        onClick={() => handleSpaceTypeChange(type.name, type.avgRate)}
                        className={`p-4 rounded-2xl text-sm font-bold transition-all border-2 text-center ${
                          spaceType === type.name 
                            ? 'bg-brand-700 border-brand-700 text-white shadow-lg' 
                            : 'bg-white border-brand-100 text-brand-600 hover:border-brand-300'
                        }`}
                      >
                        {type.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hourly Rate Slider */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-xs font-black text-brand-400 uppercase tracking-widest">Hourly Rate</label>
                    <span className="text-2xl font-black text-brand-700">${hourlyRate}</span>
                  </div>
                  <input 
                    type="range" 
                    min="20" 
                    max="500" 
                    step="5"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(parseInt(e.target.value))}
                    className="w-full h-3 bg-brand-100 rounded-lg appearance-none cursor-pointer accent-brand-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] font-bold text-brand-300 uppercase tracking-widest">
                    <span>$20</span>
                    <span>$500</span>
                  </div>
                </div>

                {/* Hours per Week Slider */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-xs font-black text-brand-400 uppercase tracking-widest">Booked Hours per Week</label>
                    <span className="text-2xl font-black text-brand-700">{hoursPerWeek}h</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="60" 
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(parseInt(e.target.value))}
                    className="w-full h-3 bg-brand-100 rounded-lg appearance-none cursor-pointer accent-brand-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] font-bold text-brand-300 uppercase tracking-widest">
                    <span>1 Hour</span>
                    <span>60 Hours</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Card */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-brand-500 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <TrendingUp className="w-32 h-32 rotate-12" />
                </div>
                
                <h3 className="text-brand-200 font-black uppercase tracking-widest text-sm mb-12">Estimated Revenue</h3>
                
                <div className="space-y-8">
                  <div>
                    <span className="text-brand-200 text-sm font-bold block mb-1">Weekly</span>
                    <div className="text-5xl font-black">${weeklyEarnings.toLocaleString()}</div>
                  </div>
                  
                  <div className="h-px bg-white/20 w-full" />
                  
                  <div>
                    <span className="text-brand-200 text-sm font-bold block mb-1">Monthly</span>
                    <div className="text-6xl font-black">${Math.round(monthlyEarnings).toLocaleString()}</div>
                  </div>

                  <div className="pt-4">
                    <div className="bg-brand-400/30 rounded-2xl p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-brand-100">Annual Total</span>
                        <span className="font-black text-2xl">${Math.round(yearlyEarnings).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => navigate('/list-your-space')}
                  className="w-full mt-10 py-5 bg-white text-brand-700 font-black text-lg rounded-2xl hover:bg-brand-200 transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 cursor-pointer"
                >
                  Start Listing Now
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              {/* Tips Card */}
              <div className="bg-brand-100 rounded-[2.5rem] p-8">
                <div className="flex items-center gap-3 mb-4 text-brand-700">
                  <Info className="w-5 h-5" />
                  <span className="font-black uppercase tracking-widest text-xs">How we calculate</span>
                </div>
                <p className="text-brand-500 text-sm font-medium leading-relaxed">
                  Estimates are based on average market rates in your category and assume a standard 15% platform fee. Actual earnings may vary based on location, amenities, and host rating.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-brand-700 mb-4">Maxmize your ROI</h2>
            <p className="text-brand-400 font-medium text-lg">Hosts who follow our guidelines earn 3x more on average.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { title: 'High-Res Photos', desc: 'Spaces with professional photography see a 40% higher booking rate.' },
              { title: 'Instant Book', desc: 'Enable instant booking to rank higher in search results and reduce friction.' },
              { title: 'Response Time', desc: 'Hosts who respond within 1 hour are more likely to secure premium bookings.' }
            ].map((item, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-brand-500" />
                </div>
                <div>
                  <h4 className="font-black text-brand-700 text-lg mb-2">{item.title}</h4>
                  <p className="text-brand-500 font-medium leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-24 px-4">
        <div className="max-w-7xl mx-auto bg-brand-100 rounded-[4rem] p-12 lg:p-20 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-brand-200/50 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black text-brand-700 mb-8">Ready to start earning?</h2>
            <p className="text-brand-400 text-lg md:text-xl font-medium mb-12 max-w-2xl mx-auto">
              Setup takes less than 10 minutes. Our team will help you optimize your listing for maximum visibility.
            </p>
            <button 
              onClick={() => navigate('/list-your-space')}
              className="px-12 py-5 bg-brand-700 text-white font-black text-xl rounded-2xl hover:bg-brand-600 transition-all shadow-xl active:scale-95 cursor-pointer"
            >
              Get Started Now
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
