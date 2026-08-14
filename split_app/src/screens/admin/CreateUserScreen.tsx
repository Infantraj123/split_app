// @ts-ignore
import React, { useMemo, useState } from 'react';
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
import { getApps, initializeApp } from 'firebase/app';
// @ts-ignore
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
// @ts-ignore
import { firebaseConfig } from '../../config/firebase';
import { userService } from '../../services/firestore.service';
import { useTheme } from '../../context/ThemeContext';
import { UserRole, UserStatus } from '../../types';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { Icon } from '../../components/Icon';

// A secondary Firebase app instance so creating the new Auth account
// does not replace the admin's current session
const getSecondaryAuth = () => {
  const name = 'user-creation';
  const existing = getApps().find((a: any) => a.name === name);
  const app = existing || initializeApp(firebaseConfig, name);
  return getAuth(app);
};

export const CreateUserScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Missing', 'Name, email and a password of at least 6 characters are required.');
      return;
    }
    setSaving(true);
    const secondaryAuth = getSecondaryAuth();
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim().toLowerCase(), password);
      await userService.createUser({
        id: cred.user.uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        createdAt: Date.now(),
      });
      Alert.alert('User created', `${name.trim()} can now log in with the password you set.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const friendly: Record<string, string> = {
        'auth/email-already-in-use': 'An account already exists for this email',
        'auth/invalid-email': 'Invalid email address',
        'auth/weak-password': 'Password is too weak',
        'auth/admin-restricted-operation': 'Sign-up is disabled for this Firebase project',
      };
      Alert.alert('Error', friendly[e?.code] || e?.message || 'Unknown error');
    } finally {
      await signOut(secondaryAuth).catch(() => {});
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: SPACING.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        placeholderTextColor={colors.textMuted}
        value={name}
        onChangeText={setName}
        editable={!saving}
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="user@example.com"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!saving}
      />

      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          placeholder="At least 6 characters"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          editable={!saving}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
          <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleCreate} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.saveText}>Create User</Text>}
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
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.surface,
      marginBottom: SPACING.lg,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      fontSize: FONT_SIZES.md,
      color: colors.text,
    },
    eyeBtn: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      ...shadow,
    },
    saveText: { color: colors.onPrimary, fontWeight: '600', fontSize: FONT_SIZES.md },
  });
