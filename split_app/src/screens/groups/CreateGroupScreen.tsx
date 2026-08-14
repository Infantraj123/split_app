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
import { useNavigation } from '@react-navigation/native';
// @ts-ignore
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { userService, groupService, groupMemberService } from '../../services/firestore.service';
import { notificationService } from '../../services/notification.service';
import { User } from '../../types';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';

export const CreateGroupScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    userService
      .listUsers()
      .then(setUsers)
      .catch((e: Error) => Alert.alert('Error', 'Failed to load users: ' + e.message))
      .finally(() => setLoadingUsers(false));
  }, []);

  const toggleUser = (userId: string) =>
    setSelected((prev) => ({ ...prev, [userId]: !prev[userId] }));

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Missing', 'Enter a group name');
      return;
    }
    if (selectedIds.length === 0) {
      Alert.alert('Missing', 'Select at least one member for the group');
      return;
    }
    setSaving(true);
    try {
      const groupId = await groupService.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        createdBy: user.id,
        createdAt: Date.now(),
        memberCount: selectedIds.length,
      });
      for (const memberId of selectedIds) {
        await groupMemberService.addMember(groupId, memberId);
      }
      await notificationService.notifyGroup({
        groupId,
        actorUserId: user.id,
        type: 'GROUP_MEMBER',
        title: `Added to group: ${name.trim()}`,
        body: 'You have been added to a new group',
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: SPACING.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Group Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Goa Trip, Flatmates"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        editable={!saving}
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="What is this group for?"
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={setDescription}
        editable={!saving}
      />

      <Text style={styles.label}>
        Members ({selectedIds.length} selected)
      </Text>
      {loadingUsers ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: SPACING.lg }} />
      ) : users.length === 0 ? (
        <EmptyState icon="person-add-outline" text="No users yet. Create users first." />
      ) : (
        <View style={styles.userList}>
          {users.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={[styles.userRow, selected[u.id] && styles.userRowSelected]}
              onPress={() => toggleUser(u.id)}
              disabled={saving}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {u.name} {u.id === user?.id ? '(you)' : ''}
                </Text>
                <Text style={styles.userEmail}>{u.email}</Text>
              </View>
              <View style={{ marginLeft: SPACING.md }}>
                <Icon
                  name={selected[u.id] ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={selected[u.id] ? colors.primary : colors.textMuted}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleCreate} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.saveText}>Create Group</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
    userList: { marginBottom: SPACING.lg },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    userRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    userName: { ...TEXT_STYLES.label, color: colors.text },
    userEmail: { fontSize: FONT_SIZES.xs, color: colors.textMuted, marginTop: 2 },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      marginBottom: SPACING.xl,
      ...shadow,
    },
    saveText: { color: colors.onPrimary, ...TEXT_STYLES.label },
  });
