// Mock authentication service for development/testing
// This simulates Firebase auth without requiring full Firebase SDK setup

interface MockUser {
  uid: string;
  email: string;
  createdAt: Date;
}

class MockAuthService {
  private currentUser: MockUser | null = null;
  private users: Map<string, { email: string; password: string; uid: string }> = new Map([
    ['test@example.com', { email: 'test@example.com', password: 'Test@123456', uid: 'user-123' }],
    ['admin@example.com', { email: 'admin@example.com', password: 'Admin@123456', uid: 'admin-1' }],
  ]);

  async signInWithEmailAndPassword(email: string, password: string) {
    return new Promise<{ user: MockUser }>((resolve, reject) => {
      setTimeout(() => {
        const user = this.users.get(email);
        if (!user) {
          reject(new Error('User not found'));
          return;
        }
        if (user.password !== password) {
          reject(new Error('Invalid password'));
          return;
        }
        this.currentUser = {
          uid: user.uid,
          email: user.email,
          createdAt: new Date(),
        };
        resolve({ user: this.currentUser });
      }, 500);
    });
  }

  async signUp(email: string, password: string) {
    return new Promise<{ user: MockUser }>((resolve, reject) => {
      setTimeout(() => {
        if (this.users.has(email)) {
          reject(new Error('Email already registered'));
          return;
        }
        const uid = `user-${Date.now()}`;
        this.users.set(email, { email, password, uid });
        this.currentUser = {
          uid,
          email,
          createdAt: new Date(),
        };
        resolve({ user: this.currentUser });
      }, 500);
    });
  }

  async signOut() {
    this.currentUser = null;
    return Promise.resolve();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }
}

export const mockAuth = new MockAuthService();
