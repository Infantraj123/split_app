// @ts-ignore
import React, { useEffect, useMemo, useState } from 'react';
// @ts-ignore
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
// @ts-ignore
import { useNavigation, useRoute } from '@react-navigation/native';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { expenseService, groupMemberService, userService } from '../../services/firestore.service';
import { notificationService } from '../../services/notification.service';
import { recalcGroupBalances } from '../../services/balance.sync';
import { computeEqualShares } from '../../services/split.logic';
import { GroupMember, SplitType } from '../../types';
import { formatCurrency } from '../../utils/formatting';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { Icon } from '../../components/Icon';

export const AddExpenseScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const groupId: string = route.params.groupId;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitType, setSplitType] = useState<SplitType>(SplitType.EQUAL);
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [equalAmongSelected, setEqualAmongSelected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      groupMemberService.getGroupMembers(groupId),
      userService.listUsers(),
    ])
      .then(([memberList, allUsers]) => {
        setMembers(memberList);
        const nameMap: Record<string, string> = {};
        allUsers.forEach(u => (nameMap[u.id] = u.name));
        setNames(nameMap);
        const inc: Record<string, boolean> = {};
        memberList.forEach(m => (inc[m.userId] = true));
        setIncluded(inc);
        // Default payer: the logged-in user if they are a member, else first member
        const me = memberList.find(m => m.userId === user?.id);
        setPaidBy(me ? me.userId : memberList[0]?.userId || '');
      })
      .catch(e => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, [groupId, user?.id]);

  const nameOf = (userId: string) => names[userId] || userId;
  const numericAmount = parseFloat(amount);
  const amountValid = !isNaN(numericAmount) && numericAmount > 0;

  const equalShares = useMemo(() => {
    if (!amountValid || members.length === 0) return new Map<string, number>();
    return computeEqualShares(
      numericAmount,
      members.map((m) => m.userId),
      paidBy
    );
  }, [numericAmount, amountValid, members, paidBy]);

  // Members ticked for the unequal split (unticked members owe nothing)
  const selectedIds = useMemo(
    () => members.filter((m) => included[m.userId]).map((m) => m.userId),
    [members, included]
  );

  const selectedEqualShares = useMemo(() => {
    if (!amountValid || selectedIds.length === 0) return new Map<string, number>();
    return computeEqualShares(numericAmount, selectedIds, paidBy);
  }, [numericAmount, amountValid, selectedIds, paidBy]);

  const customTotal = useMemo(
    () =>
      members.reduce((sum, m) => {
        if (!included[m.userId]) return sum;
        const v = parseFloat(customShares[m.userId] || '0');
        return sum + (isNaN(v) ? 0 : v);
      }, 0),
    [customShares, members, included]
  );
  const customRemaining = amountValid ? Math.round((numericAmount - customTotal) * 100) / 100 : 0;

  const toggleIncluded = (userId: string) =>
    setIncluded((prev) => ({ ...prev, [userId]: !prev[userId] }));

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Missing', 'Enter a title for the expense');
      return;
    }
    if (!amountValid) {
      Alert.alert('Missing', 'Enter a valid amount');
      return;
    }
    if (members.length === 0) {
      Alert.alert('Error', 'This group has no members');
      return;
    }
    if (!paidBy) {
      Alert.alert('Missing', 'Select who paid');
      return;
    }

    let shares: Array<{ expenseId: string; memberId: string; shareAmount: number }>;
    if (splitType === SplitType.EQUAL) {
      shares = members.map((m) => ({
        expenseId: '', // set by the service
        memberId: m.userId,
        shareAmount: equalShares.get(m.userId) || 0,
      }));
    } else {
      // Unequal: only ticked members take part; unticked members owe 0
      if (selectedIds.length === 0) {
        Alert.alert('Missing', 'Select at least one member to split between.');
        return;
      }
      if (equalAmongSelected) {
        // Equal amounts among the ticked members only
        shares = members.map((m) => ({
          expenseId: '',
          memberId: m.userId,
          shareAmount: selectedEqualShares.get(m.userId) || 0,
        }));
      } else {
        // Typed shares (blank = 0) must add up exactly to the total
        if (Math.abs(customRemaining) > 0.009) {
          Alert.alert(
            'Shares don’t add up',
            `Shares total ${formatCurrency(customTotal)} but the expense is ${formatCurrency(numericAmount)}. ` +
              (customRemaining > 0
                ? `${formatCurrency(customRemaining)} is still unassigned.`
                : `Remove ${formatCurrency(-customRemaining)} from the shares.`)
          );
          return;
        }
        const negative = members.some(
          (m) => included[m.userId] && parseFloat(customShares[m.userId] || '0') < 0
        );
        if (negative) {
          Alert.alert('Invalid share', 'Shares cannot be negative.');
          return;
        }
        shares = members.map((m) => {
          if (!included[m.userId]) {
            return { expenseId: '', memberId: m.userId, shareAmount: 0 };
          }
          const v = parseFloat(customShares[m.userId] || '0');
          return {
            expenseId: '',
            memberId: m.userId,
            shareAmount: isNaN(v) ? 0 : Math.round(v * 100) / 100,
          };
        });
      }
    }

    setSaving(true);
    try {
      await expenseService.createExpense(
        {
          groupId,
          title: title.trim(),
          amount: Math.round(numericAmount * 100) / 100,
          paidByUserId: paidBy,
          splitType,
          createdAt: Date.now(),
          createdBy: user.id,
        },
        shares
      );
      // Cloud Function triggers are not deployed; keep balances current from the client
      await recalcGroupBalances(groupId);
      await notificationService.notifyGroup({
        groupId,
        actorUserId: user.id,
        type: 'EXPENSE',
        title: `New expense: ${title.trim()}`,
        body: `${formatCurrency(Math.round(numericAmount * 100) / 100)} paid by ${nameOf(paidBy)}, added by ${nameOf(user.id)}`,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
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
      contentContainerStyle={{ padding: SPACING.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Dinner, Petrol"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
        editable={!saving}
      />

      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor={colors.textMuted}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        editable={!saving}
      />

      <Text style={styles.label}>Paid by</Text>
      <View style={styles.chipRow}>
        {members.map((m) => (
          <TouchableOpacity
            key={m.userId}
            style={[styles.chip, paidBy === m.userId && styles.chipActive]}
            onPress={() => setPaidBy(m.userId)}
            disabled={saving}
          >
            <Text style={[styles.chipText, paidBy === m.userId && styles.chipTextActive]}>
              {nameOf(m.userId)}
              {m.userId === user?.id ? ' (you)' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Split</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, splitType === SplitType.EQUAL && styles.toggleActive]}
          onPress={() => setSplitType(SplitType.EQUAL)}
          disabled={saving}
        >
          <Text style={[styles.toggleText, splitType === SplitType.EQUAL && styles.toggleTextActive]}>
            Equal Split
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, splitType === SplitType.UNEQUAL && styles.toggleActive]}
          onPress={() => setSplitType(SplitType.UNEQUAL)}
          disabled={saving}
        >
          <Text style={[styles.toggleText, splitType === SplitType.UNEQUAL && styles.toggleTextActive]}>
            Unequal Split
          </Text>
        </TouchableOpacity>
      </View>

      {splitType === SplitType.EQUAL ? (
        <View style={styles.card}>
          {members.map((m) => (
            <View key={m.userId} style={styles.shareRow}>
              <Text style={styles.shareName}>
                {nameOf(m.userId)}
                {m.userId === paidBy ? ' (paid)' : ''}
              </Text>
              <Text style={styles.shareAmount}>
                {amountValid ? formatCurrency(equalShares.get(m.userId) || 0) : '—'}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.equalToggleRow}
            onPress={() => setEqualAmongSelected((prev: boolean) => !prev)}
            disabled={saving}
          >
            <View style={[styles.checkbox, equalAmongSelected && styles.checkboxChecked]}>
              {equalAmongSelected && <Icon name="checkmark" size={14} color={colors.onPrimary} />}
            </View>
            <Text style={styles.equalToggleText}>Split equally among selected</Text>
          </TouchableOpacity>

          {members.map((m) => {
            const isIncluded = !!included[m.userId];
            return (
              <View key={m.userId} style={styles.shareRow}>
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => toggleIncluded(m.userId)}
                  disabled={saving}
                >
                  <View style={[styles.checkbox, isIncluded && styles.checkboxChecked]}>
                    {isIncluded && <Icon name="checkmark" size={14} color={colors.onPrimary} />}
                  </View>
                  <Text style={[styles.shareName, !isIncluded && styles.shareNameExcluded]}>
                    {nameOf(m.userId)}
                    {m.userId === paidBy ? ' (paid)' : ''}
                  </Text>
                </TouchableOpacity>
                {!isIncluded ? (
                  <Text style={styles.excludedText}>not included</Text>
                ) : equalAmongSelected ? (
                  <Text style={styles.shareAmount}>
                    {amountValid ? formatCurrency(selectedEqualShares.get(m.userId) || 0) : '—'}
                  </Text>
                ) : (
                  <TextInput
                    style={styles.shareInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={customShares[m.userId] || ''}
                    onChangeText={(v: string) =>
                      setCustomShares((prev) => ({ ...prev, [m.userId]: v }))
                    }
                    keyboardType="decimal-pad"
                    editable={!saving}
                  />
                )}
              </View>
            );
          })}
          {amountValid && !equalAmongSelected && (
            <View style={styles.remainingRow}>
              {Math.abs(customRemaining) <= 0.009 && <Icon name="checkmark-circle" size={14} color={colors.secondary} />}
              <Text
                style={[
                  styles.remainingText,
                  Math.abs(customRemaining) > 0.009 ? styles.remainingBad : styles.remainingOk,
                ]}
              >
                {Math.abs(customRemaining) > 0.009
                  ? customRemaining > 0
                    ? `${formatCurrency(customRemaining)} left to assign`
                    : `${formatCurrency(-customRemaining)} over the total`
                  : 'Shares match the total'}
              </Text>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.saveText}>Save Expense</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    label: {
      ...TEXT_STYLES.bodyMuted,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      fontSize: FONT_SIZES.md,
      color: colors.text,
      backgroundColor: colors.surface,
      marginBottom: SPACING.lg,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.text, fontSize: FONT_SIZES.sm },
    chipTextActive: { color: colors.onPrimary, fontWeight: '600' },
    toggleRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    toggleBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    toggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    toggleText: { color: colors.text, fontWeight: '600', fontSize: FONT_SIZES.sm },
    toggleTextActive: { color: colors.onPrimary },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadow,
    },
    shareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.sm,
    },
    shareName: { fontSize: FONT_SIZES.sm, color: colors.text, flex: 1 },
    shareNameExcluded: { color: colors.textMuted, textDecorationLine: 'line-through' },
    shareAmount: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: colors.text },
    checkRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.sm },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: RADIUS.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    equalToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingBottom: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: SPACING.sm,
    },
    equalToggleText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: colors.text },
    excludedText: { fontSize: FONT_SIZES.xs, color: colors.textMuted, fontStyle: 'italic' },
    shareInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      backgroundColor: colors.surface,
      width: 100,
      textAlign: 'right',
    },
    remainingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
    remainingText: { fontSize: FONT_SIZES.xs, fontWeight: '600' },
    remainingOk: { color: colors.secondary },
    remainingBad: { color: colors.danger },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      marginBottom: SPACING.xl,
      ...shadow,
    },
    saveText: { color: colors.onPrimary, fontWeight: '600', fontSize: FONT_SIZES.md },
  });
