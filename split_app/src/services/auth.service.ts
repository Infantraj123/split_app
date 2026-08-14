import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { userService } from './firestore.service';
import { User, UserRole, UserStatus } from '../types';

export const authService = {
  async registerUser(
    email: string,
    password: string,
    name: string,
    phone?: string
  ): Promise<User> {
    // Create Firebase auth user
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Create user document in Firestore
    const user: User = {
      id: result.user.uid,
      name,
      email,
      phone,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      createdAt: Date.now(),
    };

    await userService.createUser(user);

    return user;
  },

  async loginUser(email: string, password: string): Promise<User | null> {
    const result = await signInWithEmailAndPassword(auth, email, password);

    // Get user from Firestore
    const user = await userService.getUser(result.user.uid);

    // Check if user is disabled
    if (user && user.status === UserStatus.DISABLED) {
      await signOut(auth);
      throw new Error('User account is disabled');
    }

    return user || null;
  },

  async logoutUser(): Promise<void> {
    await signOut(auth);
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },

  /**
   * Admin function: Create user account programmatically
   * This is called by Admin only via a Cloud Function
   */
  async adminCreateUser(email: string, name: string, phone?: string): Promise<User> {
    // This would typically be called via a Cloud Function to generate a temporary password
    // For now, we'll return the user object that would be created
    const user: User = {
      id: email, // Temporary ID, will be replaced after auth user creation
      name,
      email,
      phone,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      createdAt: Date.now(),
    };

    return user;
  },

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<void> {
    await userService.updateUser(userId, updates);

    if (updates.name && auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: updates.name });
    }
  },
};
