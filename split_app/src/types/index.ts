export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum SplitType {
  EQUAL = 'EQUAL',
  UNEQUAL = 'UNEQUAL',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DeleteRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
  updatedAt?: number;
  /** FCM device tokens of this user's phones (written by push.service) */
  fcmTokens?: string[];
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
  memberCount?: number;
  totalExpenses?: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: number;
  role?: 'ADMIN' | 'MEMBER';
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  paidByUserId: string;
  splitType: SplitType;
  createdAt: number;
  createdBy: string;
  updatedAt?: number;
  category?: string;
}

export interface ExpenseShare {
  id: string;
  expenseId: string;
  memberId: string;
  shareAmount: number;
  /** How much of this share has been paid off via APPROVED settlements. Absent means 0. */
  settledAmount?: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: SettlementStatus;
  createdAt: number;
  approvedAt?: number;
  rejectedAt?: number;
  /** Set only when this settlement was created for one specific split, not a whole netted balance. */
  expenseId?: string;
}

export interface ExpenseDeleteRequest {
  id: string;
  groupId: string;
  expenseId: string;
  /** Snapshot of the expense so the request stays readable after deletion */
  expenseTitle: string;
  expenseAmount: number;
  requestedBy: string;
  /**
   * User IDs whose approval is required: the payer + members with a share
   * in the expense (+ the requester). Absent on legacy requests, which
   * required the whole group.
   */
  approversRequired?: string[];
  /** User IDs that approved; the requester is included from the start */
  approvedBy: string[];
  rejectedBy?: string;
  status: DeleteRequestStatus;
  createdAt: number;
  resolvedAt?: number;
}

export interface Balance {
  id: string;
  groupId: string;
  debtorUserId: string;
  creditorUserId: string;
  amount: number;
  updatedAt: number;
}

export interface GroupBalance {
  groupId: string;
  userId: string;
  totalOwed: number;
  totalReceivable: number;
  netBalance: number;
}

export interface ExportReport {
  type: 'PDF' | 'EXCEL';
  groupId: string;
  userId?: string;
  startDate: number;
  endDate: number;
}

export type NotificationType =
  | 'EXPENSE'
  | 'SETTLEMENT'
  | 'GROUP_MEMBER'
  | 'SETTLEMENT_APPROVAL'
  | 'EXPENSE_DELETE';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: number;
}
