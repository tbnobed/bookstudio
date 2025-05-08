import { useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function DocumentTitle() {
  const { siteName } = useSiteSettings();
  
  useEffect(() => {
    // Update document title when siteName changes
    if (siteName) {
      document.title = siteName;
    }
  }, [siteName]);
  
  // This is a utility component, it doesn't render anything
  return null;
}