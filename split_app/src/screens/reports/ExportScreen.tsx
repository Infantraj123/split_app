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
  Share,
} from 'react-native';
// @ts-ignore
import FileShare from 'react-native-share';
// @ts-ignore
import { useRoute } from '@react-navigation/native';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

dayjs.extend(customParseFormat);
import { expenseService, userService } from '../../services/firestore.service';
import { buildGroupReport } from '../../services/export.service';
import { Expense, ExpenseShare } from '../../types';
import { formatCurrency } from '../../utils/formatting';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { Icon } from '../../components/Icon';

const DATE_FORMAT = 'YYYY-MM-DD';

/** Parse an optional YYYY-MM-DD input. Returns undefined for blank, null for invalid. */
const parseDateInput = (value: string, endOfDay: boolean): number | null | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const d = dayjs(trimmed, DATE_FORMAT, true);
  if (!d.isValid()) return null;
  return endOfDay ? d.endOf('day').valueOf() : d.startOf('day').valueOf();
};

/** UTF-8 → base64 without Buffer/btoa (not guaranteed on Hermes). */
const toBase64 = (input: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const utf8: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code < 0x80) utf8.push(code);
    else if (code < 0x800) {
      utf8.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      code = 0x10000 + ((code - 0xd800) << 10) + (input.charCodeAt(++i) - 0xdc00);
      utf8.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      utf8.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  let out = '';
  for (let i = 0; i < utf8.length; i += 3) {
    const b0 = utf8[i];
    const b1 = utf8[i + 1];
    const b2 = utf8[i + 2];
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    out += b2 === undefined ? '=' : chars[b2 & 63];
  }
  return out;
};

export const ExportScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const route = useRoute<any>();
  const groupId: string = route.params.groupId;
  const groupName: string = route.params.groupName || 'Group';

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sharesByExpense, setSharesByExpense] = useState<Map<string, ExpenseShare[]>>(new Map());
  const [names, setNames] = useState<Record<string, string>>({});
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [expenseList, allUsers] = await Promise.all([
          expenseService.getGroupExpenses(groupId, 500),
          userService.listUsers(),
        ]);
        const shareMap = new Map<string, ExpenseShare[]>();
        await Promise.all(
          expenseList.map(async (e) => {
            shareMap.set(e.id, await expenseService.getExpenseShares(e.id));
          })
        );
        setExpenses(expenseList);
        setSharesByExpense(shareMap);
        const nameMap: Record<string, string> = {};
        allUsers.forEach((u) => (nameMap[u.id] = u.name));
        setNames(nameMap);
      } catch (e) {
        Alert.alert('Error', 'Failed to load expenses: ' + (e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  const start = parseDateInput(fromDate, false);
  const end = parseDateInput(toDate, true);
  const datesValid = start !== null && end !== null;

  const report = useMemo(() => {
    if (!datesValid) return null;
    return buildGroupReport({
      groupName,
      expenses,
      sharesByExpense,
      names,
      startDate: start ?? undefined,
      endDate: end ?? undefined,
      forUserId: onlyMine ? user?.id : undefined,
    });
  }, [datesValid, groupName, expenses, sharesByExpense, names, start, end, onlyMine, user?.id]);

  const myTotals = report?.userTotals.find((t) => t.userId === user?.id);

  const shareText = async () => {
    if (!report) return;
    try {
      await Share.share({
        title: `Expense Report — ${groupName}`,
        message: report.text,
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const shareCsvFile = async () => {
    if (!report) return;
    try {
      // No extension here — the share lib appends one based on the mime type
      const filename = `SplitApp-${groupName.replace(/[^a-zA-Z0-9]+/g, '_')}-${dayjs().format(
        'YYYY-MM-DD'
      )}`;
      await FileShare.open({
        title: `Expense Report — ${groupName}`,
        filename,
        url: `data:text/csv;base64,${toBase64('﻿' + report.csv)}`,
        type: 'text/csv',
        // The lib's FileProvider only whitelists the internal cache dir;
        // the default external-cache path yields a null content URI.
        useInternalStorage: true,
        failOnCancel: false,
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
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
      <Text style={styles.label}>From date (optional, YYYY-MM-DD)</Text>
      <TextInput
        style={[styles.input, start === null && styles.inputError]}
        placeholder="e.g. 2026-07-01"
        placeholderTextColor={colors.textMuted}
        value={fromDate}
        onChangeText={setFromDate}
        autoCapitalize="none"
      />

      <Text style={styles.label}>To date (optional, YYYY-MM-DD)</Text>
      <TextInput
        style={[styles.input, end === null && styles.inputError]}
        placeholder="e.g. 2026-07-31"
        placeholderTextColor={colors.textMuted}
        value={toDate}
        onChangeText={setToDate}
        autoCapitalize="none"
      />
      {!datesValid && <Text style={styles.errorText}>Enter dates as YYYY-MM-DD or leave blank.</Text>}

      <Text style={styles.label}>Scope</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, !onlyMine && styles.toggleActive]}
          onPress={() => setOnlyMine(false)}
        >
          <Text style={[styles.toggleText, !onlyMine && styles.toggleTextActive]}>Whole Group</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, onlyMine && styles.toggleActive]}
          onPress={() => setOnlyMine(true)}
        >
          <Text style={[styles.toggleText, onlyMine && styles.toggleTextActive]}>Only My Expenses</Text>
        </TouchableOpacity>
      </View>

      {report && (
        <View style={styles.card}>
          <Text style={styles.summaryTitle}>Preview</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryValue}>{report.expenses.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total spent</Text>
            <Text style={styles.summaryValue}>{formatCurrency(report.totalAmount)}</Text>
          </View>
          {myTotals && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You paid</Text>
                <Text style={styles.summaryValue}>{formatCurrency(myTotals.paid)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Your share</Text>
                <Text style={styles.summaryValue}>{formatCurrency(myTotals.share)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Net</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: myTotals.net >= 0 ? colors.secondary : colors.danger },
                  ]}
                >
                  {myTotals.net >= 0
                    ? `+${formatCurrency(myTotals.net)}`
                    : `-${formatCurrency(-myTotals.net)}`}
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, !report && { opacity: 0.5 }]}
        disabled={!report}
        onPress={shareText}
      >
        <Icon name="document-text" size={18} color={colors.onPrimary} />
        <Text style={styles.btnText}>Export Report (Text)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryBtn, !report && { opacity: 0.5 }]}
        disabled={!report}
        onPress={shareCsvFile}
      >
        <Icon name="stats-chart" size={18} color={colors.onPrimary} />
        <Text style={styles.btnText}>Export CSV File (Excel)</Text>
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
    inputError: { borderColor: colors.danger },
    errorText: { color: colors.danger, fontSize: FONT_SIZES.xs, marginBottom: SPACING.md },
    toggleRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
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
    summaryTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    summaryLabel: { color: colors.textMuted, fontSize: FONT_SIZES.sm },
    summaryValue: { color: colors.text, fontSize: FONT_SIZES.sm, fontWeight: '600' },
    primaryBtn: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
      ...shadow,
    },
    secondaryBtn: {
      flexDirection: 'row',
      backgroundColor: colors.secondary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.xl,
      ...shadow,
    },
    btnText: { color: colors.onPrimary, fontWeight: '600', fontSize: FONT_SIZES.md },
  });
