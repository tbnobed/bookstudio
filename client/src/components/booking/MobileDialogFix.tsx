import { useEffect } from 'react';

/**
 * This component is a direct DOM manipulation fix for the mobile dialog width issue.
 * It injects styles that target dialog elements with very high specificity to ensure
 * they override any existing styles that might be causing horizontal overflow.
 */
export function MobileDialogFix() {
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    styleEl.setAttribute('id', 'mobile-dialog-emergency-fix');
    
    // The CSS with !important to override everything
    styleEl.innerHTML = `
      /* Super aggressive dialog styling fix */
      body [role="dialog"],
      body [data-radix-dialog-content],
      body .DialogContent,
      [data-radix-dialog-content],
      [data-state="open"][role="dialog"] {
        width: 75vw !important;
        max-width: 75vw !important; /* Even more reduced width */
        margin: 0 auto !important;
        left: 0 !important;
        right: 0 !important;
        box-sizing: border-box !important;
        padding: 6px !important; /* Reduced padding */
        overflow-x: hidden !important;
        display: block !important;
        position: fixed !important;
      }
      
      /* Force form elements to fit */
      .mobile-booking-form,
      .mobile-booking-form * {
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
      }
      
      /* Apply globally for mobile view */
      @media (max-width: 767px) {
        [role="dialog"],
        [data-radix-dialog-content],
        .DialogContent {
          width: 85vw !important;
          max-width: 85vw !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
        }
      }
    `;
    
    // Add to the document head
    document.head.appendChild(styleEl);

    // Add class to body for targeting
    document.body.classList.add('mobile-view-active-body');
    
    // Cleanup on unmount
    return () => {
      document.head.removeChild(styleEl);
      document.body.classList.remove('mobile-view-active-body');
    };
  }, []);
  
  return null; // This component doesn't render anything
}

export default MobileDialogFix;