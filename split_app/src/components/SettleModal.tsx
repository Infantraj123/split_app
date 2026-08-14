// @ts-ignore
import React, { useEffect, useState } from 'react';
// @ts-ignore
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/formatting';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../constants/theme';
import { Icon } from './Icon';

const round2 = (n: number): number => Math.round(n * 100) / 100;

interface SettleModalProps {
  visible: boolean;
  counterpartyName: string;
  maxAmount: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (amount: number) => void;
}

/** Shared "settle up" dialog: pay the full amount owed, or type in a smaller amount. */
export const SettleModal: React.FC<SettleModalProps> = ({
  visible,
  counterpartyName,
  maxAmount,
  busy,
  onCancel,
  onConfirm,
}) => {
  const { colors, shadow } = useTheme();
  const styles = createStyles(colors, shadow);
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setCustomAmount('');
      setError('');
    }
  }, [visible]);

  const handleCustomSend = () => {
    const parsed = round2(parseFloat(customAmount));
    if (!customAmount.trim() || isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (parsed > maxAmount + 0.005) {
      setError(`Cannot exceed ${formatCurrency(maxAmount)}`);
      return;
    }
    onConfirm(parsed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>Settle up with {counterpartyName}</Text>
          <Text style={styles.subtitle}>You owe {formatCurrency(maxAmount)}</Text>

          <TouchableOpacity
            style={[styles.fullBtn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => onConfirm(maxAmount)}
          >
            <Icon name="swap-horizontal" size={16} color={colors.onPrimary} />
            <Text style={styles.fullBtnText}>Give full {formatCurrency(maxAmount)}</Text>
          </TouchableOpacity>

          <Text style={styles.orText}>or send a smaller amount</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. 98.50"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={customAmount}
            onChangeText={(t: string) => {
              setCustomAmount(t);
              setError('');
            }}
            editable={!busy}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} disabled={busy} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, busy && styles.disabled]}
              disabled={busy}
              onPress={handleCustomSend}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      ...shadow,
    },
    title: { ...TEXT_STYLES.label, fontWeight: '700', color: colors.text },
    subtitle: { ...TEXT_STYLES.bodyMuted, color: colors.textMuted, marginTop: 4, marginBottom: SPACING.md },
    fullBtn: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    fullBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: FONT_SIZES.md },
    orText: {
      ...TEXT_STYLES.bodyMuted,
      color: colors.textMuted,
      textAlign: 'center',
      marginVertical: SPACING.md,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      fontSize: FONT_SIZES.md,
      color: colors.text,
    },
    error: { color: colors.danger, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: SPACING.sm,
      marginTop: SPACING.lg,
    },
    cancelBtn: {
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.sm,
    },
    cancelBtnText: { color: colors.textMuted, fontWeight: '600', fontSize: FONT_SIZES.sm },
    sendBtn: {
      backgroundColor: colors.secondary,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.sm,
    },
    sendBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: FONT_SIZES.sm },
    disabled: { opacity: 0.5 },
  });
