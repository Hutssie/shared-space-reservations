import React, { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { motion } from 'motion/react';
import { Bell as BellIcon, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useNotifications } from '../contexts/NotificationsContext';
import { getNotificationPresentation, formatNotificationTime, getNotificationLink } from '../utils/notificationPresentation';
import type { Notification } from '../api/notifications';

export const hasUnreadNotifications = (unreadCount: number) => unreadCount > 0;

export const NotificationsDropdown = ({ trigger }: { trigger: React.ReactNode }) => {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const displayList = notifications.slice(0, 5);
  const [open, setOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const hasUnread = useMemo(() => unreadCount > 0, [unreadCount]);

  const handleNotificationClick = (notif: Notification) => {
    const link = getNotificationLink({ type: notif.type, data: notif.data });
    if (!notif.readAt) markRead(notif.id);
    setActionsOpen(false);
    setOpen(false);
    navigate(link);
  };

  return (
    <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setActionsOpen(false); }}>
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
            <div className="p-8 pb-4 flex items-center justify-between border-b border-brand-50">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-black text-brand-700">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-brand-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setActionsOpen((p) => !p)}
                  className="text-brand-400 hover:text-brand-700 transition-colors cursor-pointer"
                  aria-label="More options"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {actionsOpen && (
                  <div
                    className="absolute right-0 mt-3 w-52 bg-white rounded-2xl shadow-2xl border border-brand-100 overflow-hidden z-[120]"
                    role="menu"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (hasUnread) markAllRead();
                        setActionsOpen(false);
                      }}
                      disabled={!hasUnread}
                      className="w-full px-5 py-4 text-left font-black text-sm text-brand-700 hover:bg-brand-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      role="menuitem"
                    >
                      Mark all as read
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
              <div className="divide-y divide-brand-50">
                {displayList.length === 0 ? (
                  <div className="p-8 text-center text-brand-500 font-medium text-sm">
                    No notifications yet.
                  </div>
                ) : (
                  displayList.map((notif) => {
                    const { icon: Icon, color, bg } = getNotificationPresentation(notif.type);
                    const unread = !notif.readAt;
                    return (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full p-6 text-left hover:bg-brand-50 transition-all flex gap-5 group relative ${unread ? 'bg-brand-50/30' : ''}`}
                      >
                        {unread && (
                          <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-brand-500 rounded-full" />
                        )}
                        <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-7 h-7 ${color}`} />
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-black text-brand-700 leading-none truncate">{notif.title}</span>
                            <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest shrink-0">
                              {formatNotificationTime(notif.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-brand-500 leading-relaxed line-clamp-2">
                            {notif.message}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-6 bg-brand-50/50 flex items-center justify-center border-t border-brand-50">
              <Link
                to="/dashboard?tab=Notifications"
                onClick={() => { setActionsOpen(false); setOpen(false); }}
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
