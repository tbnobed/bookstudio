import { useSiteSettings } from "@/hooks/useSiteSettings";
import bookstudioLogo from "@assets/bookstuio.png";

export function MobileBanner() {
  const { siteName } = useSiteSettings();
  
  if (!siteName) return null;
  
  return (
    <div className="relative mb-2">
      {/* Logo above banner */}
      <div className="flex justify-center pb-2">
        <img 
          src={bookstudioLogo} 
          alt="BookStud.io Logo" 
          className="h-20 w-auto drop-shadow-lg"
        />
      </div>
      
      {/* Banner */}
      <div className="relative overflow-hidden">
        {/* Transparent gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800/30 via-blue-900/20 to-slate-800/25"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent"></div>
        
        {/* Subtle geometric pattern overlay for texture */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-white to-transparent rounded-full -translate-x-16 -translate-y-16"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white to-transparent rounded-full translate-x-12 -translate-y-12"></div>
        </div>
        
        {/* Content */}
        <div className="relative px-4 py-3 text-center">
          <h1 className="text-2xl font-bold text-white tracking-wide drop-shadow-lg">
            {siteName}
          </h1>
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
        </div>
      </div>
    </div>
  );
}