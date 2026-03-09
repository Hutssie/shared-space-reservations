import React from 'react';
import { motion } from 'motion/react';

interface UnreadBadgeProps {
  show: boolean;
  size?: 'sm' | 'md' | 'lg';
  position?: 'top-right' | 'inline';
}

export const UnreadBadge = ({ show, size = 'md', position = 'top-right' }: UnreadBadgeProps) => {
  if (!show) return null;

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  };

  const positionClasses = position === 'top-right'
    ? 'absolute -top-1 -right-1'
    : 'relative inline-block ml-2';

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className={`${sizeClasses[size]} ${positionClasses} bg-red-500 rounded-full ring-2 ring-white shrink-0`}
    >
      <span className="sr-only">Unread bookings</span>
    </motion.span>
  );
};
