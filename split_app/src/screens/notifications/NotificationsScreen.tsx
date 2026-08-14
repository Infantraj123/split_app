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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import { Swipeable } from 'react-native-gesture-handler';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { notificationService } from '../../services/notification.service';
import { Notification, NotificationType } from '../../types';
import { getRelativeTime } from '../../utils/formatting';
import { SPACING, FONT_SIZES, RADIUS, ThemeColors, ThemeShadow } from '../../constants/theme';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';

const TYPE_ICONS: Record<NotificationType, string> = {
  EXPENSE: 'cash',
  SETTLEMENT: 'swap-horizontal',
  SETTLEMENT_APPROVAL: 'checkmark-circle',
  EXPENSE_DELETE: 'trash',
  GROUP_MEMBER: 'people',
};

export const NotificationsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setNotifications(await notificationService.getUserNotifications(user.id));
    } catch (e) {
      Alert.alert('Error', 'Failed to load notifications: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unread = notifications.filter((n) => !n.isRead);

  const handleOpen = async (notification: Notification) => {
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      notificationService.markAsRead(notification.id).catch(() => {});
    }
    const groupId = notification.data?.groupId;
    if (groupId) {
      navigation.navigate('GroupDetails', {
        groupId,
        groupName: notification.data?.groupName,
      });
    }
  };

  const handleDelete = (notification: Notification) => {
    // Optimistic: remove locally, restore on failure
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    notificationService.deleteNotification(notification.id).catch((e) => {
      Alert.alert('Error', 'Could not delete notification: ' + (e as Error).message);
      load();
    });
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await notificationService.markAllAsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
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
      contentContainerStyle={{ padding: SPACING.lg }}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
    >
      {unread.length > 0 && (
        <TouchableOpacity
          style={[styles.markAllBtn, busy && styles.disabled]}
          disabled={busy}
          onPress={handleMarkAllRead}
        >
          <Text style={styles.markAllText}>Mark all {unread.length} as read</Text>
        </TouchableOpacity>
      )}

      {notifications.length === 0 ? (
        <EmptyState icon="mail-open-outline" text="No notifications yet." />
      ) : (
        notifications.map((n) => (
          <Swipeable
            key={n.id}
            overshootRight={false}
            renderRightActions={() => (
              <View style={styles.deleteAction}>
                <Icon name="trash" size={16} color={colors.onPrimary} />
                <Text style={styles.deleteActionText}>Delete</Text>
              </View>
            )}
            onSwipeableOpen={() => handleDelete(n)}
          >
            <TouchableOpacity
              style={[styles.card, !n.isRead && styles.cardUnread]}
              onPress={() => handleOpen(n)}
            >
              <View style={styles.row}>
                <View style={styles.iconWrap}>
                  <Icon name={TYPE_ICONS[n.type] || 'notifications'} size={18} color={colors.primary} />
                </View>
                <View style={styles.body}>
                  <Text style={[styles.title, !n.isRead && styles.titleUnread]}>{n.title}</Text>
                  <Text style={styles.message}>{n.body}</Text>
                  <Text style={styles.time}>{getRelativeTime(n.createdAt)}</Text>
                </View>
                {!n.isRead && <View style={styles.unreadDot} />}
              </View>
            </TouchableOpacity>
          </Swipeable>
        ))
      )}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    markAllBtn: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginBottom: SPACING.md,
    },
    markAllText: { color: colors.primary, fontSize: FONT_SIZES.xs, fontWeight: '600' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadow,
    },
    cardUnread: {
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    iconWrap: { marginRight: SPACING.md, paddingTop: 2 },
    body: { flex: 1 },
    title: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: colors.text },
    titleUnread: { fontWeight: '700' },
    message: { fontSize: FONT_SIZES.sm, color: colors.textMuted, marginTop: 2 },
    time: { fontSize: FONT_SIZES.xs, color: colors.textMuted, marginTop: SPACING.sm },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
      marginLeft: SPACING.sm,
      marginTop: 4,
    },
    disabled: { opacity: 0.5 },
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
  });
