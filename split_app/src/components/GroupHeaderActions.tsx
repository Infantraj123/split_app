// @ts-ignore
import React from 'react';
// @ts-ignore
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from './Icon';

interface GroupHeaderActionsProps {
  color: string;
  onPressSettlements: () => void;
  onPressExpenses: () => void;
  onPressExport: () => void;
}

/**
 * The 3 header-right shortcuts on a group's detail page: Settlements,
 * Expenses, Export. Each gets its own pill background so it reads as a
 * distinct tappable button rather than a row of ambiguous glyphs, and uses
 * the icon already tied to that meaning elsewhere in the app (swap-horizontal
 * = Settle, receipt = Expense, share = Export/send-out).
 */
export const GroupHeaderActions: React.FC<GroupHeaderActionsProps> = ({
  color,
  onPressSettlements,
  onPressExpenses,
  onPressExport,
}) => (
  <View style={styles.row}>
    <TouchableOpacity style={styles.btn} onPress={onPressSettlements} accessibilityLabel="Settlements">
      <Icon name="swap-horizontal" size={20} color={color} />
    </TouchableOpacity>
    <TouchableOpacity style={styles.btn} onPress={onPressExpenses} accessibilityLabel="Expenses">
      <Icon name="receipt-outline" size={20} color={color} />
    </TouchableOpacity>
    <TouchableOpacity style={styles.btn} onPress={onPressExport} accessibilityLabel="Export">
      <Icon name="share-outline" size={20} color={color} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 4 },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
