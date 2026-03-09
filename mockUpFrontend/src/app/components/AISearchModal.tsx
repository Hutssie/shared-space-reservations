import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  MapPin, 
  Star,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Link } from 'react-router';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: Space[];
}

interface Space {
  id: string;
  name: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  category: string;
}

const mockSpaces: Space[] = [
  {
    id: '1',
    name: 'Industrial Daylight Studio',
    location: 'Brooklyn, NY',
    price: 85,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1763365894901-675a14ca8888?q=80&w=400',
    category: 'Photo Studio'
  },
  {
    id: '2',
    name: 'Minimalist Podcast Suite',
    location: 'Austin, TX',
    price: 65,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1761446812363-f3edd68c5919?q=80&w=400',
    category: 'Recording Studio'
  },
  {
    id: '3',
    name: 'Modern Chef\'s Kitchen',
    location: 'Los Angeles, CA',
    price: 120,
    rating: 5.0,
    image: 'https://images.unsplash.com/photo-1766802981831-8baf453bb1ee?q=80&w=400',
    category: 'Kitchen Studio'
  }
];

export const AISearchModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your Creative Studio Scout. Tell me what kind of space you're looking for, or describe the project you're working on. I'll find the perfect match for you."
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI processing
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've found some amazing spaces that match your request for "${userMessage.content}". These locations feature exactly the aesthetic you're looking for.`,
        results: mockSpaces.slice(0, 2)
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-700/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full md:max-w-[800px] bg-white shadow-[-40px_0_100px_rgba(0,0,0,0.2)] flex flex-col z-[101] h-full"
          >
            {/* Header */}
            <div className="p-4 md:p-10 border-b border-brand-100 flex items-center justify-between bg-white/90 backdrop-blur-xl sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3 md:gap-6">
                <div className="w-10 h-10 md:w-16 md:h-16 bg-brand-700 rounded-xl md:rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-brand-700/20 rotate-3 shrink-0">
                  <Sparkles className="w-5 h-5 md:w-8 md:h-8" />
                </div>
                <div>
                  <h2 className="text-lg md:text-3xl font-black text-brand-700 leading-tight tracking-tight">AI Studio Concierge</h2>
                  <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                    <span className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-brand-400 font-black text-[9px] md:text-xs uppercase tracking-[0.2em]">Live Intelligence Active</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 md:p-4 hover:bg-brand-50 rounded-lg md:rounded-[1.5rem] transition-all text-brand-400 hover:text-brand-700 cursor-pointer group shrink-0"
              >
                <X className="w-5 h-5 md:w-8 md:h-8 group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            {/* Chat Body */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-12 bg-gradient-to-b from-brand-50/30 to-white scroll-smooth"
            >
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 md:gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center shrink-0 shadow-md border border-brand-100/50 ${msg.role === 'assistant' ? 'bg-brand-700 text-white' : 'bg-white text-brand-700'}`}>
                    {msg.role === 'assistant' ? <Bot className="w-4 h-4 md:w-6 md:h-6" /> : <User className="w-4 h-4 md:w-6 md:h-6" />}
                  </div>
                  <div className={`flex flex-col gap-3 md:gap-6 max-w-[85%] md:max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 md:p-8 rounded-[1.2rem] md:rounded-[2.5rem] shadow-sm relative text-sm md:text-lg ${msg.role === 'assistant' ? 'bg-white rounded-tl-none border border-brand-100 text-brand-700' : 'bg-brand-700 text-white rounded-tr-none'}`}>
                      <p className="font-medium leading-relaxed">{msg.content}</p>
                    </div>

                    {msg.results && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 w-full mt-1">
                        {msg.results.map((space) => (
                          <motion.div
                            key={space.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            <Link 
                              to={`/space/${space.id}`}
                              onClick={onClose}
                              className="group flex flex-col bg-white rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border border-brand-100 shadow-md hover:shadow-2xl hover:border-brand-400 transition-all p-2 md:p-4"
                            >
                              <div className="h-32 md:h-48 rounded-[1rem] md:rounded-[2rem] overflow-hidden mb-2 md:mb-4 relative">
                                <ImageWithFallback src={space.image} alt={space.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-white/95 backdrop-blur-md px-2 py-1 md:px-4 md:py-2 rounded-lg md:rounded-2xl flex items-center gap-1.5 shadow-lg">
                                  <Star className="w-2.5 h-2.5 md:w-4 md:h-4 text-brand-500 fill-brand-500" />
                                  <span className="text-[10px] md:text-sm font-black text-brand-700">{space.rating}</span>
                                </div>
                              </div>
                              <div className="px-1 md:px-2 pb-1 md:pb-2">
                                <div className="flex justify-between items-start mb-0.5 md:mb-2">
                                  <p className="text-[8px] md:text-xs font-black uppercase tracking-[0.2em] text-brand-400">{space.category}</p>
                                </div>
                                <h4 className="font-black text-brand-700 text-sm md:text-xl mb-1.5 md:mb-3 line-clamp-1">{space.name}</h4>
                                <div className="flex items-center justify-between pt-1.5 md:pt-3 border-t border-brand-50">
                                  <span className="text-sm md:text-xl font-black text-brand-700">${space.price}<span className="text-[10px] md:text-sm font-bold text-brand-400">/hr</span></span>
                                  <div className="flex items-center gap-1.5 text-[8px] md:text-xs font-black text-brand-400 uppercase tracking-widest group-hover:text-brand-700 transition-colors">
                                    Details
                                    <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex gap-3 md:gap-6">
                  <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-brand-700 text-white flex items-center justify-center shrink-0 shadow-lg">
                    <Bot className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                  <div className="bg-white p-4 md:p-8 rounded-[1.2rem] md:rounded-[2.5rem] rounded-tl-none border border-brand-100 shadow-sm flex items-center gap-2 md:gap-4">
                    <div className="flex gap-1 md:gap-1.5">
                      <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.2, times: [0, 0.5, 1] }} className="w-1 md:w-2 h-1 md:h-2 bg-brand-400 rounded-full" />
                      <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2, times: [0, 0.5, 1] }} className="w-1 md:w-2 h-1 md:h-2 bg-brand-400 rounded-full" />
                      <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4, times: [0, 0.5, 1] }} className="w-1 md:w-2 h-1 md:h-2 bg-brand-400 rounded-full" />
                    </div>
                    <span className="text-brand-400 font-black text-[9px] md:text-sm uppercase tracking-widest">Thinking</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Footer */}
            <div className="p-4 md:p-10 bg-white border-t border-brand-100 shadow-[0_-20px_50px_rgba(0,0,0,0.03)] relative z-20 shrink-0">
              <div className="space-y-4 md:space-y-8 max-w-3xl mx-auto">
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {['Industrial loft', 'Podcast suite', 'Chef kitchen'].map((suggestion) => (
                    <button 
                      key={suggestion}
                      onClick={() => setInputValue(suggestion)}
                      className="text-[8px] md:text-xs font-black uppercase tracking-widest px-3 md:px-6 py-1.5 md:py-3 bg-brand-50 text-brand-400 rounded-lg md:rounded-2xl hover:bg-brand-700 hover:text-white hover:shadow-xl transition-all cursor-pointer border border-brand-100/50 shrink-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                
                <div className="relative group">
                  <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Describe your project..."
                    className="w-full pl-4 md:pl-8 pr-12 md:pr-24 py-4 md:py-7 bg-brand-50 border-2 border-transparent rounded-xl md:rounded-[2.5rem] focus:ring-0 focus:border-brand-300 focus:bg-white transition-all font-bold text-sm md:text-xl text-brand-700 placeholder:text-brand-300 shadow-inner"
                  />
                  <button 
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isTyping}
                    className="absolute right-1.5 top-1.5 bottom-1.5 md:right-3 md:top-3 md:bottom-3 aspect-square bg-brand-700 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg md:rounded-[2rem] shadow-2xl shadow-brand-700/30 transition-all active:scale-95 flex items-center justify-center group/btn cursor-pointer"
                  >
                    <Send className="w-4 h-4 md:w-7 md:h-7 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                  </button>
                </div>
                
                <p className="text-center text-[8px] md:text-[10px] font-black text-brand-200 uppercase tracking-[0.3em]">
                  Powered by SpaceBook Engine
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
