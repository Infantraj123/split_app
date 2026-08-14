import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (timestamp: number): string => {
  return dayjs(timestamp).format('DD MMM YYYY');
};

export const formatDateTime = (timestamp: number): string => {
  return dayjs(timestamp).format('DD MMM YYYY, HH:mm');
};

export const formatTime = (timestamp: number): string => {
  return dayjs(timestamp).format('HH:mm');
};

export const getRelativeTime = (timestamp: number): string => {
  return dayjs(timestamp).fromNow();
};

export const isSameDay = (timestamp1: number, timestamp2: number): boolean => {
  return dayjs(timestamp1).isSame(dayjs(timestamp2), 'day');
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '...';
  }
  return text;
};

export const capitalizeFirst = (text: string): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const getUserInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  return phone;
};
