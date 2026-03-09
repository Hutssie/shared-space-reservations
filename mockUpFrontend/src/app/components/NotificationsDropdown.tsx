import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell as BellIcon, 
  CheckCircle2, 
  MessageSquare, 
  Clock, 
  Sparkles, 
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { Link } from 'react-router';

const mockNotifications = [
  {
    id: 1,
    type: 'booking',
    title: 'Booking Confirmed',
    message: 'Your reservation at Industrial Loft is confirmed for tomorrow at 10:00 AM.',
    time: '2 mins ago',
    unread: true,
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50'
  },
  {
    id: 2,
    type: 'message',
    title: 'New Message',
    message: 'Sarah Chen: "Hi! Looking forward to hosting you. Let me know if you need anything."',
    time: '1 hour ago',
    unread: true,
    icon: MessageSquare,
    color: 'text-brand-500',
    bg: 'bg-brand-50'
  },
  {
    id: 3,
    type: 'reminder',
    title: 'Upcoming Session',
    message: 'Your creative workshop starts in 2 hours. Don\'t forget to bring your gear!',
    time: '3 hours ago',
    unread: false,
    icon: Clock,
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
  {
    id: 4,
    type: 'system',
    title: 'New Space Nearby',
    message: 'A stunning new recording studio just opened up 2 blocks away from you.',
    time: '5 hours ago',
    unread: false,
    icon: Sparkles,
    color: 'text-purple-600',
    bg: 'bg-purple-50'
  }
];

export const NotificationsDropdown = ({ trigger }: { trigger: React.ReactNode }) => {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        {trigger}
      </Popover.Trigger>
      
      <Popover.Portal>
        <Popover.Content 
          align="end" 
          sideOffset={12}
          className="z-[100] outline-none"
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="bg-white rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(23,15,8,0.2)] border border-brand-100 overflow-hidden w-[420px] max-w-[95vw]"
          >
            {/* Header */}
            <div className="p-8 pb-4 flex items-center justify-between border-b border-brand-50">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-black text-brand-700">Notifications</h3>
                <span className="bg-brand-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  2 NEW
                </span>
              </div>
              <button className="text-brand-400 hover:text-brand-700 transition-colors cursor-pointer">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
              <div className="divide-y divide-brand-50">
                {mockNotifications.map((notif) => (
                  <button 
                    key={notif.id}
                    className={`w-full p-6 text-left hover:bg-brand-50 transition-all flex gap-5 group relative ${notif.unread ? 'bg-brand-50/30' : ''}`}
                  >
                    {notif.unread && (
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-brand-500 rounded-full" />
                    )}
                    
                    <div className={`w-14 h-14 rounded-2xl ${notif.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <notif.icon className={`w-7 h-7 ${notif.color}`} />
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-brand-700 leading-none">{notif.title}</span>
                        <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">{notif.time}</span>
                      </div>
                      <p className="text-sm font-medium text-brand-500 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-brand-50/50 flex items-center justify-center border-t border-brand-50">
              <Link 
                to="/dashboard?tab=Notifications" 
                className="flex items-center gap-2 text-sm font-black text-brand-700 hover:text-brand-400 transition-colors group"
              >
                View all notifications 
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
