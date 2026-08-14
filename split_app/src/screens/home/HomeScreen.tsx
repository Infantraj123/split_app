// @ts-ignore
import React, { useCallback, useEffect, useMemo, useState } from 'react';
// @ts-ignore
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import { useNavigation, useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { groupService } from '../../services/firestore.service';
import { notificationService } from '../../services/notification.service';
import { Group } from '../../types';
import { SPACING, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { IconCircle } from '../../components/IconCircle';
import { GradientHeaderBackground } from '../../components/GradientHeaderBackground';

const THEME_ICON: Record<string, string> = {
  system: 'contrast-outline',
  dark: 'moon',
  light: 'sunny',
};

export const HomeScreen: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const { colors, shadow, preference, cyclePreference } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const navigation = useNavigation<any>();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Live unread badge: onSnapshot pushes new notifications while the app runs
  useEffect(() => {
    if (!user) return;
    return notificationService.subscribeToUnreadCount(user.id, setUnreadCount);
  }, [user]);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    try {
      const result = isAdmin
        ? await groupService.listAllGroups()
        : await groupService.listUserGroups(user.id);
      setGroups(result);
    } catch (e) {
      console.warn('Failed to load groups:', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  // Reload whenever this screen regains focus (e.g. after creating a group)
  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadGroups} />}
    >
      <View style={styles.header}>
        <GradientHeaderBackground style={styles.headerGradient} />
        <View style={styles.headerRow}>
          <Text style={styles.greeting}>Welcome, {user?.name || 'User'}</Text>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={cyclePreference}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name={THEME_ICON[preference]} size={22} color={colors.onPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="notifications" size={22} color={colors.onPrimary} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Badge label={isAdmin ? 'ADMIN' : 'USER'} variant={isAdmin ? 'warning' : 'neutral'} />
        </View>
      </View>

      {isAdmin && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Admin Actions</Text>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CreateGroup')}>
            <IconCircle name="people" variant="secondary" />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Create Group</Text>
              <Text style={styles.actionDesc}>Start a new expense group</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CreateUser')}>
            <IconCircle name="person-add" variant="secondary" />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Create User</Text>
              <Text style={styles.actionDesc}>Register a new user account</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>{isAdmin ? 'All Groups' : 'My Groups'}</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.lg }} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            text={isAdmin ? 'No groups yet. Create one above.' : 'You are not in any group yet. Ask your admin to add you.'}
          />
        ) : (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={styles.groupCard}
              onPress={() => navigation.navigate('GroupDetails', { groupId: group.id, groupName: group.name })}
            >
              <IconCircle name="people" variant="primary" />
              <View style={styles.actionTextWrap}>
                <Text style={styles.groupName}>{group.name}</Text>
                {!!group.description && <Text style={styles.actionDesc}>{group.description}</Text>}
              </View>
              <Icon name="chevron-forward" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Icon name="log-out-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.xl,
      paddingTop: SPACING.xxl,
      borderBottomLeftRadius: RADIUS.lg,
      borderBottomRightRadius: RADIUS.lg,
      overflow: 'hidden',
    },
    headerGradient: {
      borderBottomLeftRadius: RADIUS.lg,
      borderBottomRightRadius: RADIUS.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    greeting: {
      ...TEXT_STYLES.heroTitle,
      color: colors.onPrimary,
      flex: 1,
    },
    iconBtn: {
      marginRight: SPACING.md,
      minWidth: 40,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      backgroundColor: colors.danger,
      borderRadius: RADIUS.pill,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadgeText: {
      color: colors.onPrimary,
      fontSize: 10,
      fontWeight: '700',
    },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      marginBottom: SPACING.xl,
    },
    sectionTitle: {
      ...TEXT_STYLES.sectionTitle,
      color: colors.text,
      marginBottom: SPACING.md,
    },
    actionCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadow,
    },
    actionTextWrap: {
      flex: 1,
      marginLeft: SPACING.md,
    },
    actionTitle: {
      ...TEXT_STYLES.label,
      color: colors.text,
      marginBottom: 2,
    },
    actionDesc: {
      ...TEXT_STYLES.bodyMuted,
      color: colors.textMuted,
    },
    groupCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadow,
    },
    groupName: {
      ...TEXT_STYLES.label,
      color: colors.text,
      marginBottom: 2,
    },
    footer: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xl,
    },
    logoutBtn: {
      flexDirection: 'row',
      backgroundColor: colors.danger,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    logoutText: {
      color: colors.onPrimary,
      ...TEXT_STYLES.label,
    },
  });
