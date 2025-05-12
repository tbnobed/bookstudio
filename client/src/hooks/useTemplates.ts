import { useQuery } from '@tanstack/react-query';
import { ApiTemplate } from '../types/templates';

export function useTemplates() {
  const { data: templates = [], isLoading, error } = useQuery<ApiTemplate[]>({
    queryKey: ['/api/templates'],
  });

  return {
    templates,
    isLoading,
    error,
  };
}