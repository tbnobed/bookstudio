import { useQuery, useMutation, UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import { Alert, InsertAlert } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BulkAlertResponse {
  alerts: Alert[];
  count: number;
  message: string;
}

interface UseAlertsReturn {
  alerts: UseQueryResult<Alert[], Error>;
  createAlert: UseMutationResult<Alert, Error, InsertAlert>;
  createBulkAlerts: UseMutationResult<BulkAlertResponse, Error, InsertAlert[]>;
  updateAlert: UseMutationResult<Alert, Error, { id: number; data: Partial<InsertAlert> }>;
  deleteAlert: UseMutationResult<void, Error, number>;
}

export function useAlerts(): UseAlertsReturn {
  const alerts = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const createAlert = useMutation({
    mutationFn: async (alertData: InsertAlert) => {
      const response = await apiRequest("POST", "/api/alerts", alertData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const createBulkAlerts = useMutation({
    mutationFn: async (alertItems: InsertAlert[]) => {
      const response = await apiRequest("POST", "/api/alerts/bulk", { alerts: alertItems });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const updateAlert = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertAlert> }) => {
      const response = await apiRequest("PATCH", `/api/alerts/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const deleteAlert = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  return {
    alerts,
    createAlert,
    createBulkAlerts,
    updateAlert,
    deleteAlert,
  };
}