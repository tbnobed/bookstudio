import { useSiteSettings } from "@/hooks/useSiteSettings";

export function MobileBanner() {
  const { siteName } = useSiteSettings();
  
  if (!siteName) return null;
  
  return (
    <div className="relative overflow-hidden">
      {/* Background with modern gradient and animated effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-blue-900 to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-blue-600/20 via-purple-600/20 to-transparent"></div>
      
      {/* Subtle geometric pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-white to-transparent rounded-full -translate-x-16 -translate-y-16"></div>
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white to-transparent rounded-full translate-x-12 -translate-y-12"></div>
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-white to-transparent rounded-full translate-x-20 translate-y-20"></div>
      </div>
      
      {/* Content */}
      <div className="relative px-6 py-4 text-center">
        <div className="flex items-center justify-center gap-3">
          <img 
            src="/bookstudio-logo-new.png" 
            alt="BookStud.io Logo" 
            className="w-8 h-8 object-contain drop-shadow-sm rounded-lg"
          />
          <h1 className="text-xl font-bold text-white tracking-wide drop-shadow-sm">
            {siteName}
          </h1>
        </div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
      </div>
    </div>
  );
}