import { useQuery } from '@tanstack/react-query';
import { ApiStudio } from '../types/studios';

export function useStudios() {
  const { data: studios = [], isLoading, error } = useQuery<ApiStudio[]>({
    queryKey: ['/api/studios'],
  });

  return {
    studios,
    isLoading,
    error,
  };
}