import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  Star,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageWithFallback } from './ImageWithFallback';
import { Link, useNavigate } from 'react-router';
import { chatWithAI } from '../api/ai-search';
import type { AIChatMessage } from '../api/ai-search';
import type { Space } from '../api/spaces';

interface BookingPrefill {
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: Space[];
  resultType?: 'clarify' | 'exact' | 'close' | 'none';
  followUp?: string;
  bookingPrefill?: BookingPrefill;
}

const INITIAL_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: "Hello! I'm your AI Space Assistant. Tell me what kind of space you're looking for, or describe the project you're working on — I'll find the perfect match for you."
};

const SUGGESTION_CHIPS = [
  'I need a space for a team workshop',
  'Looking to record a podcast',
  'I want to paint',
  'Cooking class venue',
  'Find me a dance studio',
];

function formatMessage(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // bold first; for italic, skip '*' after ? or ! (required-field marker)
  const regex = /(\*\*(.+?)\*\*|(?<![?!])\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

const SESSION_KEY = 'ai-chat-messages';

function loadMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [INITIAL_MESSAGE];
}

function saveMessages(msgs: Message[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(msgs));
  } catch {}
}

export const AISearchModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [bookingPromptMsgId, setBookingPromptMsgId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [bookingPromptPhase, setBookingPromptPhase] = useState<'pick' | 'confirm' | null>(null);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isOpen) return;
    // scroll container might mount after this render when reopening
    // rAF makes sure we scroll after layout/paint
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
    setIsTyping(false);
  }, [onClose]);

  const resetConversation = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setInputValue('');
    setIsTyping(false);
    setBookingPromptMsgId(null);
    setSelectedSpaceId(null);
    setBookingPromptPhase(null);
  }, []);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const history: AIChatMessage[] = updatedMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await chatWithAI(history);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        results: response.spaces,
        resultType: response.searchMeta?.resultType,
        followUp: response.followUp,
        bookingPrefill: response.bookingPrefill,
      };
      setMessages((prev) => [...prev, aiMessage]);

      if (response.spaces && response.spaces.length > 0 && response.bookingPrefill?.date) {
        setBookingPromptMsgId(aiMessage.id);
        if (response.spaces.length === 1) {
          setSelectedSpaceId(response.spaces[0].id);
          setBookingPromptPhase('confirm');
        } else {
          setSelectedSpaceId(null);
          setBookingPromptPhase('pick');
        }
      } else {
        setBookingPromptMsgId(null);
        setBookingPromptPhase(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sorry, I'm having trouble connecting right now. Please try again in a moment.";
      if (process.env.NODE_ENV !== 'production') {
        console.error('[AI Search]', err);
      }
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: message,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-brand-700/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full md:max-w-[740px] bg-white shadow-[-40px_0_100px_rgba(0,0,0,0.2)] flex flex-col z-[101] h-full"
          >
            {/* header */}
            <div className="p-4 md:p-7 border-b border-brand-100 flex items-center justify-between bg-white/90 backdrop-blur-xl sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3 md:gap-5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={resetConversation}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') resetConversation();
                  }}
                  className="relative w-10 h-10 md:w-14 md:h-14 bg-brand-700 rounded-xl md:rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-brand-700/20 rotate-3 shrink-0 ring-2 ring-transparent hover:ring-brand-300/60 transition-all cursor-pointer group"
                  aria-label="New Chat"
                >
                  <Sparkles className="w-5 h-5 md:w-7 md:h-7" />
                  <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-brand-700 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg shadow-brand-700/20 whitespace-nowrap">
                    New Chat
                  </span>
                </div>
                <div>
                  <h2 className="text-lg md:text-2xl font-black text-brand-700 leading-tight tracking-tight">AI Space Assistant</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-brand-400 font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em]">Powered by Gemini</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleClose}
                className="p-2 md:p-3 hover:bg-brand-50 rounded-lg md:rounded-xl transition-all text-brand-400 hover:text-brand-700 cursor-pointer group shrink-0"
              >
                <X className="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-90 transition-transform" />
              </button>
            </div>

            {/* chat body */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 md:p-7 space-y-5 md:space-y-9 bg-gradient-to-b from-brand-50/30 to-white scroll-smooth"
            >
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 md:gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className={`w-8 h-8 md:w-11 md:h-11 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 shadow-md border border-brand-100/50 ${msg.role === 'assistant' ? 'bg-brand-700 text-white' : 'bg-white text-brand-700'}`}>
                    {msg.role === 'assistant' ? <Bot className="w-4 h-4 md:w-5 md:h-5" /> : <User className="w-4 h-4 md:w-5 md:h-5" />}
                  </div>
                  <div className={`flex flex-col gap-2.5 md:gap-4 max-w-[85%] md:max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} ${msg.results && msg.results.length > 0 ? 'w-full' : ''}`}>
                    <div className={`p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm relative text-sm md:text-[15px] md:leading-relaxed ${msg.role === 'assistant' ? 'bg-white rounded-tl-none border border-brand-100 text-brand-700' : 'bg-brand-700 text-white rounded-tr-none'}`}>
                      <p className="font-medium leading-relaxed whitespace-pre-line">{formatMessage(msg.content)}</p>
                    </div>

                    {msg.results && msg.results.length > 0 && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full mt-1">
                          {msg.results.map((space, index) => {
                            const isMostRecommended = index === 0 && msg.resultType === 'exact' && msg.results.length > 1;
                            return (
                            <motion.div
                              key={space.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.1 }}
                              className="relative"
                            >
                              {isMostRecommended && (
                                <div className="absolute -top-2.5 left-4 z-10 flex items-center gap-1 bg-amber-500 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg shadow-amber-500/30">
                                  <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                  Most recommended!
                                </div>
                              )}
                              <Link 
                                to={`/space/${space.id}`}
                                onClick={handleClose}
                                className={`group flex flex-col bg-white rounded-[1.25rem] md:rounded-2xl overflow-hidden border shadow-md hover:shadow-2xl transition-all p-2 md:p-3.5 ${isMostRecommended ? 'border-amber-300 hover:border-amber-400' : 'border-brand-100 hover:border-brand-400'}`}
                              >
                                <div className="h-31 md:h-35 rounded-xl md:rounded-2xl overflow-hidden mb-2 md:mb-2.5 relative">
                                  <ImageWithFallback src={space.image ?? space.images?.[0] ?? ''} alt={space.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                                  {space.rating != null && (
                                    <div className="absolute top-2 right-2 md:top-2.5 md:right-2.5 bg-white/95 backdrop-blur-md px-2 py-1 md:px-2.5 md:py-1 rounded-lg flex items-center gap-1 shadow-lg">
                                      <Star className="w-2.5 h-2.5 md:w-3 md:h-3 text-brand-500 fill-brand-500" />
                                      <span className="text-[10px] md:text-xs font-black text-brand-700">{space.rating}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="px-1 md:px-2 pb-1">
                                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-brand-400 mb-0.5 line-clamp-1">{space.category}</p>
                                  <h4 className="font-black text-brand-700 text-sm md:text-base mb-1.5 line-clamp-1 leading-tight">{space.title}</h4>
                                  <div className="flex items-center justify-between pt-1.5 md:pt-2 border-t border-brand-50">
                                    <span className="text-sm md:text-base font-black text-brand-700">${space.price}<span className="text-[10px] md:text-xs font-bold text-brand-400">/hr</span></span>
                                    <div className="flex items-center gap-1.5 text-[8px] md:text-[10px] font-black text-brand-400 uppercase tracking-widest group-hover:text-brand-700 transition-colors">
                                      Details
                                      <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            </motion.div>
                            );
                          })}
                        </div>

                        {/* booking prompt */}
                        <AnimatePresence>
                          {bookingPromptMsgId === msg.id && bookingPromptPhase && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="w-full bg-brand-50 border border-brand-200 rounded-xl md:rounded-2xl p-4 md:p-5"
                            >
                              {bookingPromptPhase === 'pick' && (
                                <div className="space-y-3">
                                  <p className="text-sm md:text-base font-bold text-brand-700">Which one is your favorite?</p>
                                  <div className="flex flex-wrap gap-2">
                                    {msg.results!.map((space) => (
                                      <button
                                        key={space.id}
                                        onClick={() => {
                                          setSelectedSpaceId(space.id);
                                          setBookingPromptPhase('confirm');
                                        }}
                                        className="px-3.5 py-1.5 bg-white border border-brand-200 rounded-lg text-xs font-bold text-brand-700 hover:bg-brand-700 hover:text-white hover:border-brand-700 transition-all cursor-pointer shadow-sm"
                                      >
                                        {space.title}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {bookingPromptPhase === 'confirm' && (() => {
                                const space = msg.results!.find((s) => s.id === selectedSpaceId);
                                if (!space) return null;
                                return (
                                  <div className="space-y-3">
                                    <p className="text-sm md:text-base font-bold text-brand-700">
                                      Book <strong>{space.title}</strong>?
                                    </p>
                                    <div className="flex gap-2.5">
                                      <button
                                        onClick={() => {
                                          const prefill = msg.bookingPrefill;
                                          const params = new URLSearchParams();
                                          if (prefill?.date) params.set('date', prefill.date);
                                          if (prefill?.startTime) params.set('startTime', prefill.startTime);
                                          if (prefill?.endTime) params.set('endTime', prefill.endTime);
                                          const qs = params.toString();
                                          navigate(`/space/${space.id}${qs ? `?${qs}` : ''}#booking`);
                                          handleClose();
                                        }}
                                        className="px-4 py-2 bg-brand-700 text-white font-black text-xs rounded-lg hover:bg-brand-600 transition-all cursor-pointer shadow-lg shadow-brand-700/20 active:scale-95"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => {
                                          setBookingPromptMsgId(null);
                                          setBookingPromptPhase(null);
                                          setSelectedSpaceId(null);
                                        }}
                                        className="px-4 py-2 bg-white border border-brand-200 text-brand-700 font-black text-xs rounded-lg hover:bg-brand-50 transition-all cursor-pointer"
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {msg.followUp && (
                          <div className="p-4 md:p-5 rounded-xl md:rounded-2xl bg-brand-50 border border-brand-100 text-sm md:text-[15px] text-brand-600 w-full">
                            <p className="font-medium leading-relaxed whitespace-pre-line">{formatMessage(msg.followUp)}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex gap-3 md:gap-5">
                  <div className="w-8 h-8 md:w-11 md:h-11 rounded-lg md:rounded-xl bg-brand-700 text-white flex items-center justify-center shrink-0 shadow-lg">
                    <Bot className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-xl md:rounded-2xl rounded-tl-none border border-brand-100 shadow-sm flex items-center gap-2 md:gap-3">
                    <div className="flex gap-1 md:gap-1.5">
                      <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.2, times: [0, 0.5, 1] }} className="w-1 md:w-1.5 h-1 md:h-1.5 bg-brand-400 rounded-full" />
                      <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2, times: [0, 0.5, 1] }} className="w-1 md:w-1.5 h-1 md:h-1.5 bg-brand-400 rounded-full" />
                      <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4, times: [0, 0.5, 1] }} className="w-1 md:w-1.5 h-1 md:h-1.5 bg-brand-400 rounded-full" />
                    </div>
                    <span className="text-brand-400 font-black text-[9px] md:text-xs uppercase tracking-widest">Thinking</span>
                  </div>
                </div>
              )}
            </div>

            {/* footer input */}
            <div className="p-4 md:p-7 bg-white border-t border-brand-100 shadow-[0_-20px_50px_rgba(0,0,0,0.03)] relative z-20 shrink-0">
              <div className="space-y-3 md:space-y-6 max-w-2xl mx-auto">
                <div className="flex flex-wrap gap-2">
                  {SUGGESTION_CHIPS.map((suggestion) => (
                    <button 
                      key={suggestion}
                      onClick={() => setInputValue(suggestion)}
                      className="text-[8px] md:text-[11px] font-black uppercase tracking-widest px-3 md:px-5 py-1.5 md:py-2.5 bg-brand-50 text-brand-400 rounded-lg hover:bg-brand-700 hover:text-white hover:shadow-xl transition-all cursor-pointer border border-brand-100/50 flex-grow text-center"
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
                    placeholder="Describe what you're looking for..."
                    className="w-full pl-4 md:pl-7 pr-12 md:pr-24 py-3.5 md:py-5 bg-brand-50 border-2 border-transparent rounded-xl md:rounded-2xl focus:ring-0 focus:border-brand-300 focus:bg-white transition-all font-bold text-sm md:text-[15px] text-brand-700 placeholder:text-brand-300 shadow-inner"
                  />
                  <button 
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isTyping}
                    className="absolute right-1.5 top-1.5 bottom-1.5 md:right-2.5 md:top-2.5 md:bottom-2.5 aspect-square bg-brand-700 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg md:rounded-xl shadow-2xl shadow-brand-700/30 transition-all active:scale-95 flex items-center justify-center group/btn cursor-pointer"
                  >
                    <Send className="w-4 h-4 md:w-6 md:h-6 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
