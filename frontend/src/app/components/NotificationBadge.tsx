import { Bell } from 'lucide-react';

interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export const NotificationBadge = ({ count, className = '' }: NotificationBadgeProps) => {
  if (count <= 0) return null;
  return (
    <div className={`px-2.5 py-1 bg-orange-500/90 text-white rounded-full text-xs font-black flex items-center gap-1.5 shadow-md ${className}`}>
      <Bell className="w-3 h-3" />
      {count}
    </div>
  );
};
