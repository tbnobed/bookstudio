import { useQuery } from '@tanstack/react-query';
import { NotificationGroup } from '../types/notifications';

export function useNotificationGroups() {
  const { data: notificationGroups = [], isLoading, error } = useQuery<NotificationGroup[]>({
    queryKey: ['/api/notification-groups'],
  });

  return {
    notificationGroups,
    isLoading,
    error,
  };
}