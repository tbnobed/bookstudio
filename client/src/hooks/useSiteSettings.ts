import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useSiteSettings() {
  const { toast } = useToast();
  
  const {
    data: siteName = "BookStud.io",
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/system/site-name"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/system/site-name");
        if (!res.ok) {
          throw new Error("Failed to fetch site name");
        }
        const data = await res.json();
        return data.siteName;
      } catch (error) {
        console.error("Error fetching site name:", error);
        return "BookStud.io";
      }
    },
    // Set staleTime to 0 to always fetch the latest data
    staleTime: 0,
    // Refresh the data when the window regains focus
    refetchOnWindowFocus: true,
  });

  const updateSiteNameMutation = useMutation({
    mutationFn: async (newSiteName: string) => {
      const res = await apiRequest("PUT", "/api/system/site-name", { siteName: newSiteName });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Site name updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/system/site-name"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    siteName,
    isLoading,
    error,
    updateSiteName: updateSiteNameMutation.mutate,
    isUpdating: updateSiteNameMutation.isPending,
  };
}