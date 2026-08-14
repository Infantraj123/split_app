export const APP_NAME = 'Split App';
export const APP_VERSION = '1.0.0';

export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Please enter a valid email address',
  PASSWORD_TOO_SHORT: 'Password must be at least 6 characters',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  REQUIRED_FIELD: 'This field is required',
  INVALID_AMOUNT: 'Please enter a valid amount',
  INVALID_PHONE: 'Please enter a valid phone number',
};

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
  GROUP_CREATED: 'Group created successfully',
  EXPENSE_ADDED: 'Expense added successfully',
  SETTLEMENT_CREATED: 'Settlement request created',
  SETTLEMENT_APPROVED: 'Settlement approved',
  LOGOUT_SUCCESS: 'Logged out successfully',
};

export const TOAST_DURATION = 3000;

export const PAGINATION_LIMIT = 20;
export const INITIAL_LOAD_LIMIT = 10;

export const FREE_TIER_LIMITS = {
  FIRESTORE_READS_PER_DAY: 50000,
  FIRESTORE_WRITES_PER_DAY: 20000,
  FIRESTORE_DELETES_PER_DAY: 20000,
  FIRESTORE_STORAGE_GB: 1,
  CLOUD_FUNCTIONS_MONTHLY: 125000,
};
