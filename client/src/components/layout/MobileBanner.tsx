import { useSiteSettings } from "@/hooks/useSiteSettings";

export function MobileBanner() {
  const { siteName } = useSiteSettings();
  
  if (!siteName) return null;
  
  return (
    <div className="relative overflow-hidden">
      {/* Strong gradient background that blends with page gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-blue-800/30 to-transparent"></div>
      
      {/* Subtle geometric pattern overlay for texture */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-white to-transparent rounded-full -translate-x-16 -translate-y-16"></div>
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white to-transparent rounded-full translate-x-12 -translate-y-12"></div>
      </div>
      
      {/* Content */}
      <div className="relative px-6 py-4 text-center">
        <h1 className="text-xl font-bold text-white tracking-wide drop-shadow-lg">
          {siteName}
        </h1>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
      </div>
    </div>
  );
}