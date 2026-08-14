// @ts-ignore
import React, { useMemo, useState } from 'react';
// @ts-ignore
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
// @ts-ignore
import { auth } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONT_SIZES, RADIUS, TEXT_STYLES, ThemeColors, ThemeShadow } from '../../constants/theme';
import { Icon } from '../../components/Icon';

type StatusType = 'info' | 'success' | 'error' | 'loading';
interface Status {
  type: StatusType;
  text: string;
}

const STATUS_ICON: Record<StatusType, string> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  error: 'close-circle',
  loading: 'time',
};

const STATUS_COLOR: Record<StatusType, (colors: ThemeColors) => string> = {
  info: (colors) => colors.primary,
  loading: (colors) => colors.primary,
  success: (colors) => colors.secondary,
  error: (colors) => colors.danger,
};

const STATUS_BG: Record<StatusType, (colors: ThemeColors) => string> = {
  info: (colors) => colors.primarySoft,
  loading: (colors) => colors.primarySoft,
  success: (colors) => colors.secondarySoft,
  error: (colors) => colors.dangerSoft,
};

export const LoginScreen: React.FC = () => {
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setErrors({});
    setStatus(null);
    const newErrors: Record<string, string> = {};

    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      setStatus({ type: 'loading', text: 'Logging in...' });

      // Auth state listener in AuthContext picks this up and switches screens
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);

      setStatus({ type: 'success', text: 'Login successful! User: ' + result.user.email });
    } catch (error: any) {
      const friendlyErrors: Record<string, string> = {
        'auth/invalid-credential': 'Incorrect email or password',
        'auth/invalid-login-credentials': 'Incorrect email or password',
        'auth/user-not-found': 'No account found for this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-email': 'Invalid email address',
        'auth/too-many-requests': 'Too many attempts, try again later',
        'auth/network-request-failed': 'Network error — check your connection',
      };
      const errorMsg = friendlyErrors[error?.code] || error?.message || error?.code || 'Unknown error';
      setStatus({ type: 'error', text: 'Login failed: ' + errorMsg });
      console.error('Login error:', errorMsg, error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrors({});
    setStatus(null);

    if (!email) {
      setErrors({ email: 'Enter your email to reset the password' });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setStatus({ type: 'success', text: 'Password reset email sent to ' + email.trim() });
    } catch (error: any) {
      const friendlyErrors: Record<string, string> = {
        'auth/user-not-found': 'No account found for this email',
        'auth/invalid-email': 'Invalid email address',
        'auth/too-many-requests': 'Too many attempts, try again later',
        'auth/network-request-failed': 'Network error — check your connection',
      };
      const errorMsg = friendlyErrors[error?.code] || error?.message || 'Unknown error';
      setStatus({ type: 'error', text: 'Could not send reset email: ' + errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    setErrors({});
    setStatus({ type: 'info', text: 'Accounts are created by your group admin. Ask them to add you from the app.' });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Split App</Text>
          <Text style={styles.subtitle}>Manage shared expenses easily</Text>
        </View>

        {status && (
          <View style={[styles.messageBox, { borderLeftColor: STATUS_COLOR[status.type](colors), backgroundColor: STATUS_BG[status.type](colors) }]}>
            <Icon name={STATUS_ICON[status.type]} size={18} color={STATUS_COLOR[status.type](colors)} />
            <Text style={styles.messageText}>{status.text}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[
                styles.input,
                errors.email ? styles.inputError : undefined,
              ]}
              placeholder="Enter your email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.passwordRow,
                errors.password ? styles.inputError : undefined,
              ]}
            >
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
            <Text style={styles.forgotPassword}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.signupLink}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={handleSignUp}>
            <Text style={styles.signupButton}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (colors: ThemeColors, shadow: ThemeShadow) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    content: {
      flexGrow: 1,
      padding: SPACING.lg,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    title: {
      ...TEXT_STYLES.heroTitle,
      color: colors.primary,
      marginBottom: SPACING.sm,
    },
    subtitle: {
      ...TEXT_STYLES.body,
      color: colors.textMuted,
    },
    form: {
      marginBottom: SPACING.lg,
    },
    inputGroup: {
      marginBottom: SPACING.lg,
    },
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
      backgroundColor: colors.surfaceAlt,
    },
    inputError: {
      borderColor: colors.danger,
    },
    passwordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.surfaceAlt,
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
    errorText: {
      color: colors.danger,
      ...TEXT_STYLES.bodyMuted,
      marginTop: SPACING.sm,
    },
    loginButton: {
      backgroundColor: colors.primary,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      marginTop: SPACING.lg,
      ...shadow,
    },
    loginButtonText: {
      color: colors.onPrimary,
      ...TEXT_STYLES.label,
    },
    forgotPassword: {
      color: colors.primary,
      ...TEXT_STYLES.bodyMuted,
      textAlign: 'center',
      marginTop: SPACING.md,
    },
    signupLink: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    signupText: {
      color: colors.textMuted,
      ...TEXT_STYLES.bodyMuted,
    },
    signupButton: {
      color: colors.primary,
      ...TEXT_STYLES.bodyMuted,
      fontWeight: '600',
    },
    messageBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.sm,
      borderLeftWidth: 4,
      marginBottom: SPACING.lg,
    },
    messageText: {
      ...TEXT_STYLES.bodyMuted,
      color: colors.text,
      flex: 1,
    },
  });
