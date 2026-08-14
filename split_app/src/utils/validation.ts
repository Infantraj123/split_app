import { ERROR_MESSAGES } from '../constants/app';

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (password.length < 6) {
    return { valid: false, error: ERROR_MESSAGES.PASSWORD_TOO_SHORT };
  }
  return { valid: true };
};

export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[0-9]{10}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};

export const validateAmount = (amount: string): { valid: boolean; error?: string } => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_AMOUNT };
  }
  return { valid: true };
};

export const validateName = (name: string): boolean => {
  return name.trim().length >= 2;
};

export const validateRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

export const validatePasswordMatch = (password: string, confirmPassword: string): boolean => {
  return password === confirmPassword;
};

export const validateExpenseShares = (
  shares: Array<{ userId: string; amount: number }>,
  totalAmount: number
): { valid: boolean; error?: string } => {
  const totalShares = shares.reduce((sum, s) => sum + s.amount, 0);

  if (Math.abs(totalShares - totalAmount) > 0.01) {
    return { valid: false, error: 'Total shares must equal total amount' };
  }

  if (shares.some((s) => s.amount < 0)) {
    return { valid: false, error: 'Share amount cannot be negative' };
  }

  return { valid: true };
};

export const validateDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

export const validateDateRange = (startDate: Date, endDate: Date): boolean => {
  return startDate < endDate;
};
