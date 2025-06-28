import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useSiteSettings() {
  const { toast } = useToast();
  
  const {
    data: siteData,
    isLoading,
    error,
  } = useQuery<{ siteName: string }>({
    queryKey: ["/api/system/site-name"],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const siteName = siteData?.siteName || "BookStud.io";

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