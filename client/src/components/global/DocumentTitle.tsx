import { useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useQueryClient } from "@tanstack/react-query";

export function DocumentTitle() {
  const { siteName } = useSiteSettings();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // Update document title when siteName changes
    if (siteName) {
      document.title = siteName;
      console.log("Document title updated to:", siteName);
    }
  }, [siteName]);
  
  // Set up refetch interval for site name to ensure real-time updates
  useEffect(() => {
    // Set up a regular polling interval to check for site name changes
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/site-name"] });
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, [queryClient]);
  
  // This is a utility component, it doesn't render anything
  return null;
}