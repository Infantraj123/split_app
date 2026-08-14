// @ts-ignore
import React, { useCallback, useMemo, useState } from 'react';
// @ts-ignore
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
// @ts-ignore
import { Swipeable } from 'react-native-gesture-handler';
// @ts-ignore
import { useFocusEffect, useRoute } from '@react-navigation/native';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userService, expenseService, settlementService } from '../../services/firestore.service';
import { notificationService } from '../../services/notification.service';
import { recalcGroupBalances } from '../../services/balance.sync';
import { Expense, Settlement, SettlementStatus } from '../../types';
import { formatCurrency } from '../../utils/formatting';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';

export const GroupSettlementsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const route = useRoute<any>();
  const groupId: string = route.params.groupId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  const load = useCallback(async () => {
    try {
      const [expenseList, settlementList, allUsers] = await Promise.all([
        expenseService.getGroupExpenses(groupId),
        settlementService.getGroupSettlements(groupId),
        userService.listUsers(),
      ]);
      setExpenses(expenseList);
      setSettlements(settlementList);
      const nameMap: Record<string, string> = {};
      allUsers.forEach((u) => (nameMap[u.id] = u.name));
      setNames(nameMap);
    } catch (e) {
      Alert.alert('Error', 'Failed to load settlements: ' + (e as Error).message);
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
  // Newest first, capped to the latest 10 — most relevant/pending activity reads at the top.
  const settlementsNewestFirst = [...settlements].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

  const statusBadge = (status: SettlementStatus) => {
    switch (status) {
      case SettlementStatus.APPROVED:
        return {
          icon: 'checkmark-circle',
          text: 'Approved',
          color: colors.secondary,
          style: styles.badgeApproved,
          textStyle: styles.badgeTextApproved,
        };
      case SettlementStatus.REJECTED:
        return {
          icon: 'close-circle',
          text: 'Rejected',
          color: colors.danger,
          style: styles.badgeRejected,
          textStyle: styles.badgeTextRejected,
        };
      default:
        return {
          icon: 'time',
          text: 'Pending',
          color: colors.warning,
          style: styles.badgePending,
          textStyle: styles.badgeTextPending,
        };
    }
  };

  const handleSettlementDecision = async (settlement: Settlement, approve: boolean) => {
    setBusy(true);
    try {
      await settlementService.updateSettlementStatus(
        settlement.id,
        approve ? 'APPROVED' : 'REJECTED',
        approve ? Date.now() : undefined
      );
      if (approve) {
        // No deployed Cloud Function triggers, so recalc balances here
        await recalcGroupBalances(groupId);
      }
      await notificationService.notifyGroup({
        groupId,
        actorUserId: user?.id || '',
        type: 'SETTLEMENT_APPROVAL',
        title: approve ? 'Settlement approved' : 'Settlement rejected',
        body: `${nameOf(settlement.toUserId)} ${approve ? 'approved' : 'rejected'} the settlement of ${formatCurrency(settlement.amount)} from ${nameOf(settlement.fromUserId)}`,
      });
      await load();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSettlement = (settlement: Settlement) => {
    setSettlements((prev) => prev.filter((s) => s.id !== settlement.id));
    settlementService.deleteSettlement(settlement.id).catch((e) => {
      Alert.alert('Error', 'Could not delete settlement: ' + (e as Error).message);
      load();
    });
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
      contentContainerStyle={{ padding: SPACING.lg }}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
    >
      {settlementsNewestFirst.length === 0 ? (
        <EmptyState icon="swap-horizontal-outline" text="No settlements yet." />
      ) : (
        settlementsNewestFirst.map((s) => {
          const badge = statusBadge(s.status);
          const forExpense = s.expenseId ? expenses.find((e) => e.id === s.expenseId) : undefined;
          const canDelete =
            (s.status === SettlementStatus.PENDING && s.fromUserId === user?.id) ||
            (s.status === SettlementStatus.REJECTED && (s.fromUserId === user?.id || s.toUserId === user?.id));
          const card = (
            <View style={styles.card}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceText}>
                  <Text style={styles.bold}>{nameOf(s.fromUserId)}</Text> →{' '}
                  <Text style={styles.bold}>{nameOf(s.toUserId)}</Text>: {formatCurrency(s.amount)}
                  {forExpense ? ` for "${forExpense.title}"` : ''}
                </Text>
                <View style={[styles.badge, badge.style]}>
                  <Icon name={badge.icon} size={12} color={badge.color} />
                  <Text style={[styles.badgeText, badge.textStyle]}>{badge.text}</Text>
                </View>
              </View>
              {s.status === SettlementStatus.PENDING &&
                (s.toUserId === user?.id ? (
                  <View style={styles.decisionRow}>
                    <TouchableOpacity
                      style={[styles.approveBtn, busy && styles.disabled]}
                      disabled={busy}
                      onPress={() => handleSettlementDecision(s, true)}
                    >
                      <Icon name="checkmark" size={16} color={colors.onPrimary} />
                      <Text style={styles.btnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.rejectBtn, busy && styles.disabled]}
                      disabled={busy}
                      onPress={() => handleSettlementDecision(s, false)}
                    >
                      <Icon name="close" size={16} color={colors.onPrimary} />
                      <Text style={styles.btnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.pendingHint}>Waiting for {nameOf(s.toUserId)} to approve</Text>
                ))}
              {s.status === SettlementStatus.REJECTED && s.fromUserId === user?.id && (
                <Text style={styles.rejectedHint}>
                  {nameOf(s.toUserId)} rejected this settlement — the amount is still owed.
                </Text>
              )}
            </View>
          );
          return canDelete ? (
            <Swipeable
              key={s.id}
              overshootRight={false}
              renderRightActions={() => (
                <View style={styles.deleteAction}>
                  <Icon name="trash" size={16} color={colors.onPrimary} />
                  <Text style={styles.deleteActionText}>Delete</Text>
                </View>
              )}
              onSwipeableOpen={() => handleDeleteSettlement(s)}
            >
              {card}
            </Swipeable>
          ) : (
            <View key={s.id}>{card}</View>
          );
        })
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
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
    deleteAction: {
      flexDirection: 'row',
      backgroundColor: colors.danger,
      borderRadius: RADIUS.md,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
      flex: 1,
    },
    deleteActionText: { color: colors.onPrimary, fontWeight: '700', fontSize: FONT_SIZES.sm },
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
    badgeApproved: { backgroundColor: colors.secondarySoft },
    badgeTextApproved: { color: colors.secondary },
    badgeRejected: { backgroundColor: colors.dangerSoft },
    badgeTextRejected: { color: colors.danger },
    disabled: { opacity: 0.5 },
  });
