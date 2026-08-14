// @ts-ignore
import React, { useCallback, useMemo, useState } from 'react';
// @ts-ignore
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  userService,
  groupMemberService,
  settlementService,
  balanceService,
} from '../../services/firestore.service';
import { notificationService } from '../../services/notification.service';
import { EPSILON } from '../../services/balance.engine';
import { Balance, GroupMember, Settlement, SettlementStatus } from '../../types';
import { formatCurrency } from '../../utils/formatting';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { Icon } from '../../components/Icon';
import { GradientHeaderBackground } from '../../components/GradientHeaderBackground';
import { GlassCard } from '../../components/GlassCard';
import { SettleModal } from '../../components/SettleModal';

export const GroupDetailScreen: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const groupId: string = route.params.groupId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settleBalance, setSettleBalance] = useState<Balance | null>(null);

  const load = useCallback(async () => {
    try {
      const [memberList, balanceList, settlementList, allUsers] = await Promise.all([
        groupMemberService.getGroupMembers(groupId),
        balanceService.getGroupBalances(groupId),
        settlementService.getGroupSettlements(groupId),
        userService.listUsers(),
      ]);
      setMembers(memberList);
      setBalances(balanceList.filter((b) => b.amount > 0));
      setSettlements(settlementList);
      const nameMap: Record<string, string> = {};
      allUsers.forEach((u) => (nameMap[u.id] = u.name));
      setNames(nameMap);
    } catch (e) {
      Alert.alert('Error', 'Failed to load group: ' + (e as Error).message);
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
  const pendingSettlements = settlements.filter((s) => s.status === SettlementStatus.PENDING);

  // Your net position in this group, summed directly from the same `balances`
  // rows rendered below — no separate/parallel calculation to drift out of sync.
  const netForMe = user
    ? balances.reduce((sum, b) => {
        if (b.creditorUserId === user.id) return sum + b.amount;
        if (b.debtorUserId === user.id) return sum - b.amount;
        return sum;
      }, 0)
    : 0;
  // Up = you need to send money (you owe); down = you're due to get money.
  const heroIcon = netForMe > EPSILON ? 'arrow-down-circle' : netForMe < -EPSILON ? 'arrow-up-circle' : 'checkmark-done-circle';
  const heroLabel =
    netForMe > EPSILON ? "You'll receive overall" : netForMe < -EPSILON ? 'You owe overall' : 'All settled in this group';
  const heroValue = Math.abs(netForMe) > EPSILON ? formatCurrency(Math.abs(netForMe)) : '—';

  const handleSettle = (balance: Balance) => {
    const alreadyPending = pendingSettlements.some(
      (s) => s.fromUserId === balance.debtorUserId && s.toUserId === balance.creditorUserId
    );
    if (alreadyPending) {
      Alert.alert(
        'Already pending',
        `You already sent a settlement to ${nameOf(balance.creditorUserId)}. Wait for them to approve or reject it.`
      );
      return;
    }
    setSettleBalance(balance);
  };

  const confirmSettle = async (amount: number) => {
    if (!settleBalance) return;
    const balance = settleBalance;
    setBusy(true);
    try {
      await settlementService.createSettlement({
        groupId,
        fromUserId: balance.debtorUserId,
        toUserId: balance.creditorUserId,
        amount,
        status: SettlementStatus.PENDING,
        createdAt: Date.now(),
      });
      await notificationService.notifyGroup({
        groupId,
        actorUserId: user?.id || '',
        type: 'SETTLEMENT',
        title: 'Settlement requested',
        body: `${nameOf(balance.debtorUserId)} wants to settle ${formatCurrency(amount)} with ${nameOf(balance.creditorUserId)}`,
      });
      setSettleBalance(null);
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
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
    >
      

      <View style={styles.hero}>
        <GradientHeaderBackground style={styles.heroGradient} />
        <GlassCard style={styles.heroCard}>
          <Text style={styles.heroLabel}>Your balance in this group</Text>
          <View style={styles.heroValueRow}>
            <Icon name={heroIcon} size={28} color={colors.onPrimary} />
            <Text style={styles.heroValue}>{heroValue}</Text>
          </View>
          <Text style={styles.heroSubLabel}>{heroLabel}</Text>
        </GlassCard>
      </View>

      {isMember && (
        <View style={styles.topActionRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('AddExpense', { groupId })}
          >
            <Icon name="add-circle" size={18} color={colors.onPrimary} />
            <Text style={styles.btnText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Balances</Text>
        {balances.length === 0 ? (
          <View style={styles.card}>
            <View style={styles.settledRow}>
              <Icon name="checkmark-done-circle" size={18} color={colors.secondary} />
              <Text style={styles.emptyText}>All settled up!</Text>
            </View>
          </View>
        ) : (
          balances.map((b) => (
            <TouchableOpacity
              key={b.id}
              style={styles.card}
              onPress={() =>
                navigation.navigate('BalanceDetail', {
                  groupId,
                  debtorUserId: b.debtorUserId,
                  creditorUserId: b.creditorUserId,
                })
              }
            >
              <View style={styles.balanceRow}>
                <Text style={styles.balanceText}>
                  {b.creditorUserId === user?.id ? (
                    <>
                      <Text style={styles.bold}>{nameOf(b.debtorUserId)}</Text> owes you
                    </>
                  ) : b.debtorUserId === user?.id ? (
                    <>
                      You owe <Text style={styles.bold}>{nameOf(b.creditorUserId)}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.bold}>{nameOf(b.debtorUserId)}</Text> owes{' '}
                      <Text style={styles.bold}>{nameOf(b.creditorUserId)}</Text>
                    </>
                  )}
                </Text>
                <Text style={styles.amount}>{formatCurrency(b.amount)}</Text>
              </View>
              <View style={styles.detailHint}>
                <Text style={styles.detailHintText}>Tap for split breakdown</Text>
                <Icon name="chevron-forward" size={14} color={colors.primary} />
              </View>
              {b.debtorUserId === user?.id && (
                <TouchableOpacity
                  style={[styles.settleBtn, busy && styles.disabled]}
                  disabled={busy}
                  onPress={() => handleSettle(b)}
                >
                  <Icon name="swap-horizontal" size={16} color={colors.onPrimary} />
                  <Text style={styles.btnText}>Settle</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={[styles.section, { paddingBottom: SPACING.xl }]}>
        <View style={styles.membersHeaderRow}>
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          {isAdmin && (
            <TouchableOpacity
              style={styles.addMemberBtn}
              onPress={() => navigation.navigate('AddMember', { groupId })}
            >
              <Icon name="person-add" size={14} color={colors.primary} />
              <Text style={styles.addMemberBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.card}>
          {members.map((m) => (
            <Text key={m.id} style={styles.memberRow}>
              • {nameOf(m.userId)} {m.userId === user?.id ? '(you)' : ''}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
    <SettleModal
      visible={!!settleBalance}
      counterpartyName={settleBalance ? nameOf(settleBalance.creditorUserId) : ''}
      maxAmount={settleBalance?.amount || 0}
      busy={busy}
      onCancel={() => setSettleBalance(null)}
      onConfirm={confirmSettle}
    />
    </>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    topActionRow: {
      padding: SPACING.lg,
      paddingBottom: 0,
    },
    hero: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xl,
      borderBottomLeftRadius: RADIUS.lg,
      borderBottomRightRadius: RADIUS.lg,
      overflow: 'hidden',
    },
    heroGradient: {
      borderBottomLeftRadius: RADIUS.lg,
      borderBottomRightRadius: RADIUS.lg,
    },
    heroCard: {
      alignItems: 'center',
    },
    heroLabel: {
      ...TEXT_STYLES.bodyMuted,
      color: colors.onPrimary,
      opacity: 0.85,
    },
    heroValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
    heroValue: {
      fontSize: 34,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    heroSubLabel: {
      ...TEXT_STYLES.bodyMuted,
      color: colors.onPrimary,
      opacity: 0.85,
      marginTop: SPACING.sm,
    },
    primaryBtn: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      ...shadow,
    },
    btnText: { color: colors.onPrimary, fontWeight: '600', fontSize: FONT_SIZES.sm },
    section: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
    sectionTitle: {
      ...TEXT_STYLES.sectionTitle,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    membersHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    addMemberBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.sm + 2,
      paddingVertical: 3,
      marginBottom: SPACING.sm,
    },
    addMemberBtnText: { color: colors.primary, fontSize: FONT_SIZES.xs, fontWeight: '600' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadow,
    },
    memberRow: { fontSize: FONT_SIZES.sm, color: colors.text, paddingVertical: 4 },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    balanceText: { fontSize: FONT_SIZES.sm, color: colors.text, flex: 1 },
    bold: { fontWeight: '700' },
    amount: { ...TEXT_STYLES.label, fontWeight: '700', color: colors.danger },
    settleBtn: {
      flexDirection: 'row',
      backgroundColor: colors.secondary,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: SPACING.sm,
    },
    settledRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
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
    emptyText: { color: colors.textMuted, fontSize: FONT_SIZES.sm },
    disabled: { opacity: 0.5 },
  });
