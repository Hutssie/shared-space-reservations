import React from 'react';
import {
  CheckCircle2,
  MessageSquare,
  Clock,
  Sparkles,
  CreditCard,
  Package,
  Shield,
  Star,
  Trash2,
  User,
  Bell,
} from 'lucide-react';

export type NotificationPresentation = {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  typeLabel: string;
};

const TYPE_MAP: Record<string, NotificationPresentation> = {
  booking_confirmed: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    typeLabel: 'Booking',
  },
  booking_request: {
    icon: Package,
    color: 'text-brand-400',
    bg: 'bg-brand-50',
    typeLabel: 'Booking',
  },
  booking_cancelled: {
    icon: Trash2,
    color: 'text-red-600',
    bg: 'bg-red-50',
    typeLabel: 'Booking',
  },
  message_received: {
    icon: MessageSquare,
    color: 'text-brand-500',
    bg: 'bg-brand-50',
    typeLabel: 'Message',
  },
  review_received: {
    icon: Star,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    typeLabel: 'Review',
  },
  reminder: {
    icon: Clock,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    typeLabel: 'Reminder',
  },
  system: {
    icon: Sparkles,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    typeLabel: 'System',
  },
  promotion: {
    icon: Sparkles,
    color: 'text-brand-500',
    bg: 'bg-brand-100',
    typeLabel: 'Promotion',
  },
  billing: {
    icon: CreditCard,
    color: 'text-brand-700',
    bg: 'bg-brand-100',
    typeLabel: 'Billing',
  },
  billing_payout: {
    icon: CreditCard,
    color: 'text-green-700',
    bg: 'bg-green-50',
    typeLabel: 'Billing',
  },
  security: {
    icon: Shield,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    typeLabel: 'Security',
  },
  profile: {
    icon: User,
    color: 'text-brand-600',
    bg: 'bg-brand-50',
    typeLabel: 'Profile',
  },
};

const DEFAULT_PRESENTATION: NotificationPresentation = {
  icon: Bell,
  color: 'text-brand-500',
  bg: 'bg-brand-50',
  typeLabel: 'Notification',
};

export function getNotificationPresentation(type: string): NotificationPresentation {
  if (!type) return DEFAULT_PRESENTATION;
  const key = type.toLowerCase().replace(/\s+/g, '_');
  if (TYPE_MAP[key]) return TYPE_MAP[key];
  if (key.startsWith('billing')) return TYPE_MAP.billing_payout ?? TYPE_MAP.billing;
  if (key.startsWith('security')) return TYPE_MAP.security;
  if (key.startsWith('review')) return TYPE_MAP.review_received;
  if (key.startsWith('message')) return TYPE_MAP.message_received;
  if (key.startsWith('booking')) {
    if (key.includes('cancel')) return TYPE_MAP.booking_cancelled;
    if (key.includes('confirm')) return TYPE_MAP.booking_confirmed;
    return TYPE_MAP.booking_request;
  }
  return DEFAULT_PRESENTATION;
}

export function getNotificationLink(notif: {
  type: string;
  data?: {
    bookingId?: string;
    threadId?: string;
    spaceId?: string;
    senderId?: string;
    destination?: 'host_space_bookings';
  } | null;
}): string {
  const data = notif.data;
  if (data?.destination === 'host_space_bookings' && data?.spaceId) {
    return `/host/manage-listings/${data.spaceId}/bookings`;
  }
  if (data?.bookingId) return '/dashboard?tab=My%20Bookings';
  if (notif.type === 'message_received' && data?.threadId) {
    // tab messages foloseste deep link `with=<otherUserId>` ca sa deschida conversatia corecta
    if (data.senderId) return `/dashboard?tab=Messages&with=${encodeURIComponent(data.senderId)}`;
    return '/dashboard?tab=Messages';
  }
  return '/dashboard?tab=Notifications';
}

export function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}
