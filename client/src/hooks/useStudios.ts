import { useQuery } from '@tanstack/react-query';
import { Studio } from '../types/studios';

export function useStudios() {
  const { data: studios = [], isLoading, error } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
  });

  return {
    studios,
    isLoading,
    error,
  };
}