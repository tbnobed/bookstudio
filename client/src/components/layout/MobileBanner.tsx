import { useSiteSettings } from "@/hooks/useSiteSettings";
import bookstudioLogo from "@assets/bookstuio.png";

export function MobileBanner() {
  const { siteName } = useSiteSettings();
  
  if (!siteName) return null;
  
  return (
    <div className="relative overflow-hidden">
      {/* Strong gradient background that blends with page gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-800 via-blue-900 to-slate-800"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent"></div>
      
      {/* Fade effect at bottom to blend with page background gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-transparent via-blue-100/60 to-blue-50"></div>
      
      {/* Subtle geometric pattern overlay for texture */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-white to-transparent rounded-full -translate-x-16 -translate-y-16"></div>
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white to-transparent rounded-full translate-x-12 -translate-y-12"></div>
      </div>
      
      {/* Content */}
      <div className="relative px-6 py-6 text-center">
        <h1 className="text-2xl font-bold text-white tracking-wide drop-shadow-lg mb-2">
          {siteName}
        </h1>
        <img 
          src={bookstudioLogo} 
          alt="BookStud.io Logo" 
          className="h-40 w-auto mx-auto drop-shadow-lg"
        />
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-20 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
      </div>
    </div>
  );
}