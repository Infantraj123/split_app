// @ts-ignore
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
// @ts-ignore
import { db } from '../config/firebase';
import { groupMemberService, groupService } from './firestore.service';
import { Notification, NotificationType } from '../types';

/**
 * In-app notification fan-out. Cloud Functions are not deployed, so
 * notification docs are written client-side by whoever performs the action;
 * other clients pick them up live via `subscribeToUnreadCount` (onSnapshot).
 * Note: these are delivered while the app is running — true OS push (FCM)
 * would need native messaging modules plus a deployed backend sender.
 */

const toMillis = (timestamp: any): number => {
  if (timestamp instanceof Timestamp) return timestamp.toMillis();
  return typeof timestamp === 'number' ? timestamp : Date.now();
};

export const notificationService = {
  /**
   * Notify every member of a group except the actor. The group name is
   * appended to the body so notifications make sense outside the group
   * screen. Never throws: a notification failure must not break the
   * action that triggered it.
   */
  async notifyGroup(params: {
    groupId: string;
    actorUserId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    /** Restrict to these user IDs (e.g. only the people involved in an expense) */
    recipientUserIds?: string[];
  }): Promise<void> {
    try {
      const [members, group] = await Promise.all([
        groupMemberService.getGroupMembers(params.groupId),
        groupService.getGroup(params.groupId),
      ]);
      const recipients = members.filter(
        (m) =>
          m.userId !== params.actorUserId &&
          (!params.recipientUserIds || params.recipientUserIds.includes(m.userId))
      );
      if (recipients.length === 0) return;

      const body = group ? `${params.body} · ${group.name}` : params.body;
      const batch = writeBatch(db);
      for (const member of recipients) {
        const ref = doc(collection(db, 'notifications'));
        batch.set(ref, {
          userId: member.userId,
          type: params.type,
          title: params.title,
          body,
          data: { groupId: params.groupId, groupName: group?.name, ...params.data },
          isRead: false,
          pushSent: false,
          createdAt: Timestamp.now(),
        });
      }
      await batch.commit();
    } catch (e) {
      console.warn('Failed to send notifications:', (e as Error).message);
    }
  },

  async getUserNotifications(userId: string, limitCount = 100): Promise<Notification[]> {
    // No orderBy: equality filter + orderBy needs a composite index; sort client-side
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          ...data,
          id: docSnap.id,
          createdAt: toMillis(data.createdAt),
        } as Notification;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /** Live unread count for the badge; returns the unsubscribe function. */
  subscribeToUnreadCount(userId: string, onChange: (count: number) => void): () => void {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    return onSnapshot(
      q,
      (snapshot) => onChange(snapshot.size),
      (e) => console.warn('Notification listener error:', e.message)
    );
  },

  async markAsRead(notificationId: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  },

  async deleteNotification(notificationId: string): Promise<void> {
    await deleteDoc(doc(db, 'notifications', notificationId));
  },

  async markAllAsRead(userId: string): Promise<void> {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => batch.update(docSnap.ref, { isRead: true }));
    await batch.commit();
  },
};
