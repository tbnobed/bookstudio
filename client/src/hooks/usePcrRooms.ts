import { useQuery } from '@tanstack/react-query';
import { PcrRoom } from '../types/pcr-rooms';

export function usePcrRooms() {
  const { data: pcrRooms = [], isLoading, error } = useQuery<PcrRoom[]>({
    queryKey: ['/api/pcr-rooms'],
  });

  return {
    pcrRooms,
    isLoading,
    error,
  };
}