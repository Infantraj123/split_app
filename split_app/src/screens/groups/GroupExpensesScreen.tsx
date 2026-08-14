// @ts-ignore
import React, { useCallback, useMemo, useState } from 'react';
// @ts-ignore
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
// @ts-ignore
import { useFocusEffect, useRoute } from '@react-navigation/native';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  userService,
  groupMemberService,
  expenseService,
  deleteRequestService,
} from '../../services/firestore.service';
import { notificationService } from '../../services/notification.service';
import { recalcGroupBalances } from '../../services/balance.sync';
import { isShareSettled } from '../../services/balance.engine';
import { DeleteRequestStatus, Expense, ExpenseDeleteRequest, ExpenseShare, GroupMember } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';

export const GroupExpensesScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const route = useRoute<any>();
  const groupId: string = route.params.groupId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sharesByExpense, setSharesByExpense] = useState<Map<string, ExpenseShare[]>>(new Map());
  const [deleteRequests, setDeleteRequests] = useState<ExpenseDeleteRequest[]>([]);

  const load = useCallback(async () => {
    try {
      const [memberList, expenseList, deleteRequestList, allUsers] = await Promise.all([
        groupMemberService.getGroupMembers(groupId),
        expenseService.getGroupExpenses(groupId),
        deleteRequestService.getGroupDeleteRequests(groupId),
        userService.listUsers(),
      ]);
      setMembers(memberList);
      setExpenses(expenseList);
      setDeleteRequests(deleteRequestList);
      const nameMap: Record<string, string> = {};
      allUsers.forEach((u) => (nameMap[u.id] = u.name));
      setNames(nameMap);

      // Best-effort: only used to hide fully-settled expenses from the list.
      // A failure here must not block the core data above from showing.
      try {
        const shareMap = new Map<string, ExpenseShare[]>();
        await Promise.all(
          expenseList.map(async (e) => {
            shareMap.set(e.id, await expenseService.getExpenseShares(e.id));
          })
        );
        setSharesByExpense(shareMap);
      } catch (e) {
        console.error('Failed to load expense shares (settled-expense hiding disabled this load):', e);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load expenses: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const nameOf = (userId: string) => names[userId] || userId;
  const isMember = members.some((m) => m.userId === user?.id);
  const pendingDeleteRequests = deleteRequests.filter((r) => r.status === DeleteRequestStatus.PENDING);

  const isExpenseSettled = (expense: Expense): boolean => {
    const owedShares = (sharesByExpense.get(expense.id) || []).filter(
      (s) => s.memberId !== expense.paidByUserId && s.shareAmount > 0
    );
    return owedShares.length > 0 && owedShares.every(isShareSettled);
  };
  const visibleExpenses = expenses.filter((e) => !isExpenseSettled(e));
  const settledExpenseCount = expenses.length - visibleExpenses.length;

  const statusBadge = (status: DeleteRequestStatus) => {
    switch (status) {
      case DeleteRequestStatus.REJECTED:
        return {
          icon: 'close-circle',
          text: 'Rejected',
          style: styles.badgeRejected,
          textStyle: styles.badgeTextRejected,
        };
      default:
        return {
          icon: 'time',
          text: 'Pending',
          style: styles.badgePending,
          textStyle: styles.badgeTextPending,
        };
    }
  };

  const showExpenseDetail = async (expense: Expense) => {
    try {
      const shares = await expenseService.getExpenseShares(expense.id);
      const breakdown = shares
        .filter((s) => s.shareAmount > 0)
        .map(
          (s) =>
            `${nameOf(s.memberId)}${s.memberId === user?.id ? ' (you)' : ''}: ${formatCurrency(s.shareAmount)}`
        )
        .join('\n');
      Alert.alert(
        expense.title,
        `Total: ${formatCurrency(expense.amount)}\nPaid by: ${nameOf(expense.paidByUserId)}\n` +
          `Split: ${expense.splitType}\nDate: ${formatDate(expense.createdAt)}\n\nShares:\n${breakdown || '—'}`
      );
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const handleRequestDelete = async (expense: Expense) => {
    if (!user) return;
    if (pendingDeleteRequests.some((r) => r.expenseId === expense.id)) {
      Alert.alert('Already requested', 'A delete request for this expense is already pending approval.');
      return;
    }
    // Only the people involved in this expense (payer + anyone with a share)
    // need to approve — not the whole group
    let approversRequired: string[];
    try {
      const shares = await expenseService.getExpenseShares(expense.id);
      const involved = new Set<string>([expense.paidByUserId, user.id]);
      shares.filter((s) => s.shareAmount > 0).forEach((s) => involved.add(s.memberId));
      approversRequired = [...involved];
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
      return;
    }
    const others = approversRequired.filter((id) => id !== user.id);
    Alert.alert(
      'Delete Expense',
      others.length === 0
        ? `Delete "${expense.title}" (${formatCurrency(expense.amount)})? This cannot be undone.`
        : `Request deletion of "${expense.title}" (${formatCurrency(expense.amount)})? ` +
            `${others.map(nameOf).join(', ')} must approve before it is deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: others.length === 0 ? 'Delete' : 'Request Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              if (others.length === 0) {
                // No one else involved in this expense, delete right away
                await expenseService.deleteExpense(expense.id);
                await recalcGroupBalances(groupId);
              } else {
                await deleteRequestService.createDeleteRequest({
                  groupId,
                  expenseId: expense.id,
                  expenseTitle: expense.title,
                  expenseAmount: expense.amount,
                  requestedBy: user.id,
                  approversRequired,
                  approvedBy: [user.id],
                  status: DeleteRequestStatus.PENDING,
                  createdAt: Date.now(),
                });
                await notificationService.notifyGroup({
                  groupId,
                  actorUserId: user.id,
                  type: 'EXPENSE_DELETE',
                  title: 'Delete requested',
                  body: `${nameOf(user.id)} wants to delete "${expense.title}" (${formatCurrency(expense.amount)}) — your approval is needed`,
                  recipientUserIds: others,
                });
                Alert.alert('Requested', 'The expense will be deleted once everyone involved approves.');
              }
              await load();
            } catch (e) {
              Alert.alert('Error', (e as Error).message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  // Legacy requests (before approversRequired existed) needed the whole group
  const requiredApprovers = (request: ExpenseDeleteRequest): string[] =>
    request.approversRequired?.length ? request.approversRequired : members.map((m) => m.userId);

  const handleDeleteDecision = async (request: ExpenseDeleteRequest, approve: boolean) => {
    if (!user) return;
    const required = requiredApprovers(request);
    setBusy(true);
    try {
      if (!approve) {
        await deleteRequestService.markRejected(request.id, user.id);
        await notificationService.notifyGroup({
          groupId,
          actorUserId: user.id,
          type: 'EXPENSE_DELETE',
          title: 'Delete rejected',
          body: `${nameOf(user.id)} rejected deleting "${request.expenseTitle}" — the expense was kept`,
          recipientUserIds: required,
        });
      } else {
        await deleteRequestService.addApproval(request.id, user.id);
        const approvals = new Set([...request.approvedBy, user.id]);
        const everyoneApproved = required.every((id) => approvals.has(id));
        if (everyoneApproved) {
          await expenseService.deleteExpense(request.expenseId);
          await deleteRequestService.markApproved(request.id);
          await recalcGroupBalances(groupId);
          await notificationService.notifyGroup({
            groupId,
            actorUserId: user.id,
            type: 'EXPENSE_DELETE',
            title: 'Expense deleted',
            body: `"${request.expenseTitle}" (${formatCurrency(request.expenseAmount)}) was deleted after everyone involved approved`,
            recipientUserIds: required,
          });
          Alert.alert('Deleted', `"${request.expenseTitle}" was approved by everyone involved and deleted.`);
        } else {
          const approvedCount = required.filter((id) => approvals.has(id)).length;
          await notificationService.notifyGroup({
            groupId,
            actorUserId: user.id,
            type: 'EXPENSE_DELETE',
            title: 'Delete approval',
            body: `${nameOf(user.id)} approved deleting "${request.expenseTitle}" (${approvedCount}/${required.length} approved)`,
            recipientUserIds: required,
          });
        }
      }
      await load();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
    >
      {deleteRequests.some((r) => r.status !== DeleteRequestStatus.APPROVED) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delete Requests</Text>
          {deleteRequests
            // Fully approved requests are done — the expense is gone, hide the card
            .filter((r) => r.status !== DeleteRequestStatus.APPROVED)
            .map((r) => {
              const badge = statusBadge(r.status);
              const required = requiredApprovers(r);
              const hasApproved = !!user && r.approvedBy.includes(user.id);
              const mustApprove = !!user && required.includes(user.id);
              const approvedCount = required.filter((id) => r.approvedBy.includes(id)).length;
              const waitingOn = required.filter((id) => !r.approvedBy.includes(id));
              return (
                <View key={r.id} style={styles.card}>
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceText}>
                      Delete <Text style={styles.bold}>{r.expenseTitle}</Text> (
                      {formatCurrency(r.expenseAmount)})
                    </Text>
                    <View style={[styles.badge, badge.style]}>
                      <Icon name={badge.icon} size={12} color={badge.style === styles.badgeRejected ? colors.danger : colors.warning} />
                      <Text style={[styles.badgeText, badge.textStyle]}>{badge.text}</Text>
                    </View>
                  </View>
                  <Text style={styles.expenseMeta}>
                    Requested by {nameOf(r.requestedBy)}
                    {r.requestedBy === user?.id ? ' (you)' : ''} · {approvedCount}/
                    {required.length} involved approved
                  </Text>
                  {r.status === DeleteRequestStatus.PENDING &&
                    (isMember && mustApprove && !hasApproved ? (
                      <View style={styles.decisionRow}>
                        <TouchableOpacity
                          style={[styles.approveBtn, busy && styles.disabled]}
                          disabled={busy}
                          onPress={() => handleDeleteDecision(r, true)}
                        >
                          <Icon name="checkmark" size={16} color={colors.onPrimary} />
                          <Text style={styles.btnText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rejectBtn, busy && styles.disabled]}
                          disabled={busy}
                          onPress={() => handleDeleteDecision(r, false)}
                        >
                          <Icon name="close" size={16} color={colors.onPrimary} />
                          <Text style={styles.btnText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.pendingHint}>
                        Waiting for {waitingOn.map(nameOf).join(', ') || '—'} to approve
                      </Text>
                    ))}
                  {r.status === DeleteRequestStatus.REJECTED && r.rejectedBy && (
                    <Text style={styles.rejectedHint}>
                      {nameOf(r.rejectedBy)} rejected this request — the expense was kept.
                    </Text>
                  )}
                </View>
              );
            })}
        </View>
      )}

      <View style={[styles.section, { paddingBottom: SPACING.xl }]}>
        <Text style={styles.sectionTitle}>Expenses ({visibleExpenses.length})</Text>
        {settledExpenseCount > 0 && (
          <Text style={styles.expenseMeta}>
            {settledExpenseCount} settled expense{settledExpenseCount === 1 ? '' : 's'} hidden — export to view
            them
          </Text>
        )}
        {visibleExpenses.length === 0 ? (
          <EmptyState icon="receipt-outline" text="No expenses yet." />
        ) : (
          visibleExpenses.map((e) => {
            const deletePending = pendingDeleteRequests.some((r) => r.expenseId === e.id);
            return (
              <TouchableOpacity key={e.id} style={styles.card} onPress={() => showExpenseDetail(e)}>
                <View style={styles.balanceRow}>
                  <Text style={styles.expenseTitle}>{e.title}</Text>
                  <Text style={styles.amount}>{formatCurrency(e.amount)}</Text>
                </View>
                <Text style={styles.expenseMeta}>
                  Paid by {nameOf(e.paidByUserId)} · {formatDate(e.createdAt)}
                </Text>
                <View style={styles.expenseFooter}>
                  <View style={styles.detailHint}>
                    <Text style={styles.detailHintText}>Tap to see split details</Text>
                    <Icon name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                  {isMember &&
                    (deletePending ? (
                      <View style={[styles.badge, styles.badgePending]}>
                        <Icon name="time" size={12} color={colors.warning} />
                        <Text style={[styles.badgeText, styles.badgeTextPending]}>Delete requested</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.deleteBtn, busy && styles.disabled]}
                        disabled={busy}
                        onPress={() => handleRequestDelete(e)}
                      >
                        <Icon name="trash" size={12} color={colors.danger} />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    section: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
    sectionTitle: {
      ...TEXT_STYLES.sectionTitle,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadow,
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    balanceText: { fontSize: FONT_SIZES.sm, color: colors.text, flex: 1 },
    bold: { fontWeight: '700' },
    expenseTitle: { ...TEXT_STYLES.label, fontWeight: '700', color: colors.text, flex: 1 },
    amount: { ...TEXT_STYLES.label, fontWeight: '700', color: colors.danger },
    btnText: { color: colors.onPrimary, fontWeight: '600', fontSize: FONT_SIZES.sm },
    decisionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
    approveBtn: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: colors.secondary,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    rejectBtn: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: colors.danger,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    pendingHint: { color: colors.textMuted, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm },
    rejectedHint: { color: colors.danger, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.sm + 2,
      paddingVertical: 3,
      marginLeft: SPACING.sm,
    },
    badgeText: { ...TEXT_STYLES.badge },
    badgePending: { backgroundColor: colors.warningSoft },
    badgeTextPending: { color: colors.warning },
    badgeRejected: { backgroundColor: colors.dangerSoft },
    badgeTextRejected: { color: colors.danger },
    expenseMeta: { color: colors.textMuted, fontSize: FONT_SIZES.xs, marginTop: 4 },
    expenseFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.dangerSoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.sm + 2,
      paddingVertical: 3,
      marginTop: SPACING.sm,
    },
    deleteBtnText: { color: colors.danger, fontSize: FONT_SIZES.xs, fontWeight: '600' },
    detailHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'flex-start',
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.sm + 2,
      paddingVertical: 3,
      marginTop: SPACING.sm,
    },
    detailHintText: { color: colors.primary, fontSize: FONT_SIZES.xs, fontWeight: '600' },
    disabled: { opacity: 0.5 },
  });
