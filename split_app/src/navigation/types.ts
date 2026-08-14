export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  GroupDetails: { groupId: string; groupName?: string };
  AddExpense: { groupId: string };
  CreateGroup: undefined;
  CreateUser: undefined;
  AddMember: { groupId: string };
  ExportReport: { groupId: string; groupName?: string };
  GroupSettlements: { groupId: string; groupName?: string };
  GroupExpenses: { groupId: string; groupName?: string };
  Notifications: undefined;
  BalanceDetail: { groupId: string; debtorUserId: string; creditorUserId: string };
};
