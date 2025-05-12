import { useQuery } from '@tanstack/react-query';
import { Template } from '../types/templates';

export function useTemplates() {
  const { data: templates = [], isLoading, error } = useQuery<Template[]>({
    queryKey: ['/api/templates'],
  });

  return {
    templates,
    isLoading,
    error,
  };
}