import { useSiteSettings } from "@/hooks/useSiteSettings";

export function MobileBanner() {
  const { siteName } = useSiteSettings();
  
  if (!siteName) return null;
  
  return (
    <div className="relative">
      {/* Subtle backdrop blur effect */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-sm border-b border-white/20"></div>
      
      {/* Content */}
      <div className="relative px-6 py-3 text-center">
        <h1 className="text-lg font-semibold text-gray-800 tracking-wide">
          {siteName}
        </h1>
      </div>
    </div>
  );
}