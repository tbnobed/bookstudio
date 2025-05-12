import { useQuery } from '@tanstack/react-query';
import { PcrRoom } from '../types/bookings';

export function usePcrRooms() {
  const { data: pcrRooms = [], isLoading, error } = useQuery<PcrRoom[]>({
    queryKey: ['/api/pcr-rooms'],
  });

  return { pcrRooms, isLoading, error };
}