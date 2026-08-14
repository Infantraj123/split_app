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
} from 'react-native';
// @ts-ignore
import { useRoute, useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userService, groupService, groupMemberService } from '../../services/firestore.service';
import { notificationService } from '../../services/notification.service';
import { User } from '../../types';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { Icon } from '../../components/Icon';

export const AddMemberScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const route = useRoute<any>();
  const groupId: string = route.params.groupId;

  const [users, setUsers] = useState<User[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [allUsers, members] = await Promise.all([
        userService.listUsers(),
        groupMemberService.getGroupMembers(groupId),
      ]);
      setUsers(allUsers);
      setMemberIds(new Set(members.map((m) => m.userId)));
    } catch (e) {
      Alert.alert('Error', 'Failed to load: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleMember = async (target: User) => {
    const isMember = memberIds.has(target.id);
    setBusyUserId(target.id);
    try {
      if (isMember) {
        await groupMemberService.removeMember(groupId, target.id);
      } else if (!(await groupMemberService.isGroupMember(groupId, target.id))) {
        await groupMemberService.addMember(groupId, target.id);
      }
      const members = await groupMemberService.getGroupMembers(groupId);
      await groupService.updateGroup(groupId, { memberCount: members.length });
      setMemberIds(new Set(members.map((m) => m.userId)));
      await notificationService.notifyGroup({
        groupId,
        actorUserId: user?.id || '',
        type: 'GROUP_MEMBER',
        title: isMember ? 'Member removed' : 'Member added',
        body: `${target.name} was ${isMember ? 'removed from' : 'added to'} the group`,
      });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusyUserId(null);
    }
  };

  const confirmToggle = (target: User) => {
    if (memberIds.has(target.id)) {
      Alert.alert('Remove member', `Remove ${target.name} from this group?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => toggleMember(target) },
      ]);
    } else {
      toggleMember(target);
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: SPACING.lg }}>
      <Text style={styles.hint}>
        Tap a user to add or remove them. Members: {memberIds.size}
      </Text>
      {users.map((u) => {
        const isMember = memberIds.has(u.id);
        const busy = busyUserId === u.id;
        return (
          <View key={u.id} style={[styles.userRow, isMember && styles.userRowMember]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{u.name}</Text>
              <Text style={styles.userEmail}>{u.email}</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleBtn, isMember ? styles.removeBtn : styles.addBtn, busy && { opacity: 0.5 }]}
              onPress={() => confirmToggle(u)}
              disabled={busy || busyUserId !== null}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <Icon name={isMember ? 'person-remove' : 'person-add'} size={16} color={colors.onPrimary} />
                  <Text style={styles.toggleText}>{isMember ? 'Remove' : 'Add'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    hint: { color: colors.textMuted, ...TEXT_STYLES.bodyMuted, marginBottom: SPACING.md },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.sm,
      ...shadow,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    userRowMember: {
      borderColor: colors.secondary,
    },
    userName: { ...TEXT_STYLES.label, color: colors.text },
    userEmail: { fontSize: FONT_SIZES.xs, color: colors.textMuted, marginTop: 2 },
    toggleBtn: {
      flexDirection: 'row',
      borderRadius: RADIUS.sm,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      marginLeft: SPACING.md,
      minWidth: 100,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    addBtn: { backgroundColor: colors.primary },
    removeBtn: { backgroundColor: colors.danger },
    toggleText: { color: colors.onPrimary, fontWeight: '600', fontSize: FONT_SIZES.sm },
  });
