import { useQuery } from '@tanstack/react-query';
import { ApiPcrRoom } from '../types/pcr-rooms';

export function usePcrRooms() {
  const { data: pcrRooms = [], isLoading, error } = useQuery<ApiPcrRoom[]>({
    queryKey: ['/api/pcr-rooms'],
  });

  return {
    pcrRooms,
    isLoading,
    error,
  };
}