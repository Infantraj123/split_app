// @ts-ignore
import React, { createContext, useState, useContext, useEffect, useRef, ReactNode } from 'react';
// @ts-ignore
import { onAuthStateChanged, signOut } from 'firebase/auth';
// @ts-ignore
import { auth } from '../config/firebase';
import { userService } from '../services/firestore.service';
import { registerPushToken, unregisterPushToken } from '../services/push.service';
import { User, UserRole, UserStatus } from '../types';

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  initializing: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const tokenRefreshUnsub = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser: any) => {
      if (fbUser) {
        let profile: User | null = null;
        try {
          profile = await userService.getUser(fbUser.uid);
        } catch (e) {
          console.warn('Could not load user profile:', (e as Error).message);
        }
        setUser(
          profile || {
            id: fbUser.uid,
            name: fbUser.displayName || fbUser.email || 'User',
            email: fbUser.email || '',
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
            createdAt: Date.now(),
          }
        );
        // Attach this device's FCM token to the profile for OS push
        tokenRefreshUnsub.current = await registerPushToken(fbUser.uid);
      } else {
        setUser(null);
      }
      setInitializing(false);
    });
    return () => {
      unsubscribe();
      tokenRefreshUnsub.current?.();
    };
  }, []);

  const logout = async () => {
    tokenRefreshUnsub.current?.();
    tokenRefreshUnsub.current = null;
    if (user) {
      await unregisterPushToken(user.id);
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAdmin: user?.role === UserRole.ADMIN,
        initializing,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
