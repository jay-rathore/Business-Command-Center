import { NotificationType, PermissionModule, Priority } from '../enums';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  priority: Priority;
  title: string;
  message: string;
  linkModule: PermissionModule | null;
  linkRecordId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
