// @ts-ignore
import React, { useCallback, useMemo, useState } from 'react';
// @ts-ignore
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
// @ts-ignore
import { useFocusEffect, useRoute } from '@react-navigation/native';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userService, expenseService, settlementService } from '../../services/firestore.service';
import { notificationService } from '../../services/notification.service';
import { isShareSettled, EPSILON } from '../../services/balance.engine';
import { Expense, ExpenseShare, Settlement, SettlementStatus } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { Icon } from '../../components/Icon';
import { SettleModal } from '../../components/SettleModal';

const round2 = (n: number): number => Math.round(n * 100) / 100;

interface SplitItem {
  expense: Expense;
  share: ExpenseShare;
  owedBy: string;
  owedTo: string;
}

export const BalanceDetailScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const route = useRoute<any>();
  const groupId: string = route.params.groupId;
  const debtorUserId: string = route.params.debtorUserId;
  const creditorUserId: string = route.params.creditorUserId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [items, setItems] = useState<SplitItem[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settleItem, setSettleItem] = useState<SplitItem | null>(null);

  const load = useCallback(async () => {
    try {
      const [expenses, settlementList, allUsers] = await Promise.all([
        expenseService.getGroupExpenses(groupId),
        settlementService.getGroupSettlements(groupId),
        userService.listUsers(),
      ]);
      const sharesByExpense = new Map<string, ExpenseShare[]>();
      await Promise.all(
        expenses.map(async (e) => {
          sharesByExpense.set(e.id, await expenseService.getExpenseShares(e.id));
        })
      );

      const splitItems: SplitItem[] = [];
      for (const expense of expenses) {
        const shares = sharesByExpense.get(expense.id) || [];
        if (expense.paidByUserId === creditorUserId) {
          const share = shares.find((s) => s.memberId === debtorUserId && s.shareAmount > 0);
          if (share) splitItems.push({ expense, share, owedBy: debtorUserId, owedTo: creditorUserId });
        }
        if (expense.paidByUserId === debtorUserId) {
          const share = shares.find((s) => s.memberId === creditorUserId && s.shareAmount > 0);
          if (share) splitItems.push({ expense, share, owedBy: creditorUserId, owedTo: debtorUserId });
        }
      }
      splitItems.sort((a, b) => a.expense.createdAt - b.expense.createdAt);

      setItems(splitItems);
      setSettlements(settlementList);
      const nameMap: Record<string, string> = {};
      allUsers.forEach((u) => (nameMap[u.id] = u.name));
      setNames(nameMap);
    } catch (e) {
      Alert.alert('Error', 'Failed to load split breakdown: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [groupId, debtorUserId, creditorUserId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const nameOf = (userId: string) => names[userId] || userId;
  const nameWithYou = (userId: string) => (userId === user?.id ? `${nameOf(userId)} (you)` : nameOf(userId));
  const owesText = (fromId: string, toId: string) => {
    if (fromId === user?.id) {
      return (
        <>
          You owe <Text style={styles.bold}>{nameOf(toId)}</Text>
        </>
      );
    }
    if (toId === user?.id) {
      return (
        <>
          <Text style={styles.bold}>{nameOf(fromId)}</Text> owes you
        </>
      );
    }
    return (
      <>
        <Text style={styles.bold}>{nameOf(fromId)}</Text> owes <Text style={styles.bold}>{nameOf(toId)}</Text>
      </>
    );
  };

  const unsettledItems = items.filter((item) => !isShareSettled(item.share));
  // Newest first, settled splits excluded entirely — this screen is about
  // what's still outstanding between these two, not a full history.
  const unsettledItemsNewestFirst = [...unsettledItems].sort((a, b) => b.expense.createdAt - a.expense.createdAt);

  // Remaining-per-item is the exact same value each row below displays —
  // summing it here (rather than a separate computation) guarantees the
  // two totals can never drift out of sync with what's shown per split.
  const remainingOf = (item: SplitItem) => round2(item.share.shareAmount - (item.share.settledAmount || 0));
  const totalDebtorOwesCreditor = unsettledItems
    .filter((item) => item.owedBy === debtorUserId)
    .reduce((sum, item) => sum + remainingOf(item), 0);
  const totalCreditorOwesDebtor = unsettledItems
    .filter((item) => item.owedBy === creditorUserId)
    .reduce((sum, item) => sum + remainingOf(item), 0);

  // Single net direction between these two — mirrors the group hero's
  // up/down-arrow convention instead of showing both raw totals side by side.
  const netUnsettled = totalDebtorOwesCreditor - totalCreditorOwesDebtor;
  const netDebtorId = netUnsettled > EPSILON ? debtorUserId : netUnsettled < -EPSILON ? creditorUserId : null;
  const netCreditorId = netUnsettled > EPSILON ? creditorUserId : netUnsettled < -EPSILON ? debtorUserId : null;
  const netAmount = Math.abs(netUnsettled);
  const netIcon =
    netDebtorId === null
      ? 'checkmark-done-circle'
      : netDebtorId === user?.id
      ? 'arrow-up-circle'
      : netCreditorId === user?.id
      ? 'arrow-down-circle'
      : 'swap-horizontal';
  const netIconColor =
    netDebtorId === null ? colors.secondary : netDebtorId === user?.id ? colors.danger : colors.secondary;

  const handleSettleSplit = (item: SplitItem) => {
    const alreadyPending = settlements.some(
      (s) => s.status === SettlementStatus.PENDING && s.fromUserId === item.owedBy && s.toUserId === item.owedTo
    );
    if (alreadyPending) {
      Alert.alert(
        'Already pending',
        `You already sent a settlement to ${nameOf(item.owedTo)}. Wait for them to approve or reject it.`
      );
      return;
    }
    setSettleItem(item);
  };

  const confirmSettleSplit = async (amount: number) => {
    if (!settleItem) return;
    const item = settleItem;
    setBusy(true);
    try {
      await settlementService.createSettlement({
        groupId,
        fromUserId: item.owedBy,
        toUserId: item.owedTo,
        amount,
        status: SettlementStatus.PENDING,
        createdAt: Date.now(),
        expenseId: item.expense.id,
      });
      await notificationService.notifyGroup({
        groupId,
        actorUserId: user?.id || '',
        type: 'SETTLEMENT',
        title: 'Settlement requested',
        body: `${nameOf(item.owedBy)} wants to settle ${formatCurrency(amount)} with ${nameOf(item.owedTo)} for "${item.expense.title}"`,
      });
      setSettleItem(null);
      Alert.alert('Sent', 'Settlement sent for approval.');
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
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: SPACING.lg }}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
    >
      <Text style={styles.header}>
        {nameWithYou(debtorUserId)} & {nameWithYou(creditorUserId)}
      </Text>

      {unsettledItems.length > 0 && (
        <View style={styles.summaryCard}>
          <Icon name={netIcon} size={28} color={netIconColor} />
          <Text style={styles.summaryValue}>{netDebtorId === null ? '—' : formatCurrency(netAmount)}</Text>
          <Text style={styles.summaryLabel}>
            {netDebtorId === null ? 'All settled up' : owesText(netDebtorId, netCreditorId!)}
          </Text>
        </View>
      )}

      {items.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>No shared expenses between these two yet.</Text>
        </View>
      ) : unsettledItemsNewestFirst.length === 0 ? (
        <View style={styles.card}>
          <View style={styles.settledRow}>
            <Icon name="checkmark-done-circle" size={18} color={colors.secondary} />
            <Text style={styles.emptyText}>All settled up between these two!</Text>
          </View>
        </View>
      ) : (
        unsettledItemsNewestFirst.map((item) => {
          const remaining = remainingOf(item);
          return (
            <View key={item.share.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.title}>{item.expense.title}</Text>
                <Text style={styles.amount}>{formatCurrency(item.share.shareAmount)}</Text>
              </View>
              <Text style={styles.meta}>{formatDate(item.expense.createdAt)}</Text>
              <Text style={styles.balanceText}>{owesText(item.owedBy, item.owedTo)}</Text>
              <View style={styles.footer}>
                <View style={[styles.badge, styles.badgePending]}>
                  <Icon name="time" size={12} color={colors.warning} />
                  <Text style={[styles.badgeText, styles.badgeTextPending]}>
                    Unsettled · {formatCurrency(remaining)}
                  </Text>
                </View>
                {item.owedBy === user?.id && (
                  <TouchableOpacity
                    style={[styles.settleBtn, busy && styles.disabled]}
                    disabled={busy}
                    onPress={() => handleSettleSplit(item)}
                  >
                    <Icon name="swap-horizontal" size={14} color={colors.onPrimary} />
                    <Text style={styles.settleBtnText}>Settle this split</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
    <SettleModal
      visible={!!settleItem}
      counterpartyName={settleItem ? nameOf(settleItem.owedTo) : ''}
      maxAmount={settleItem ? remainingOf(settleItem) : 0}
      busy={busy}
      onCancel={() => setSettleItem(null)}
      onConfirm={confirmSettleSplit}
    />
    </>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    header: { ...TEXT_STYLES.sectionTitle, fontWeight: '700', color: colors.text, marginBottom: SPACING.lg },
    summaryCard: {
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadow,
    },
    summaryValue: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
    },
    summaryLabel: {
      ...TEXT_STYLES.bodyMuted,
      color: colors.textMuted,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadow,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { ...TEXT_STYLES.label, fontWeight: '700', color: colors.text, flex: 1 },
    amount: { ...TEXT_STYLES.label, fontWeight: '700', color: colors.danger },
    meta: { color: colors.textMuted, fontSize: FONT_SIZES.xs, marginTop: 4 },
    balanceText: { fontSize: FONT_SIZES.sm, color: colors.text, marginTop: SPACING.sm },
    bold: { fontWeight: '700' },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: SPACING.md,
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.sm + 2,
      paddingVertical: 3,
    },
    badgeText: { ...TEXT_STYLES.badge },
    badgePending: { backgroundColor: colors.warningSoft },
    badgeTextPending: { color: colors.warning },
    settledRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    settleBtn: {
      flexDirection: 'row',
      backgroundColor: colors.secondary,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    settleBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: FONT_SIZES.xs },
    emptyText: { color: colors.textMuted, fontSize: FONT_SIZES.sm },
    disabled: { opacity: 0.5 },
  });
