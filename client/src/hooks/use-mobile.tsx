import * as React from "react"

// Breakpoint sizes
const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

export interface DeviceInfo {
  isMobile: boolean;      // Phones (< 768px)
  isTablet: boolean;      // Tablets (768px - 1024px)
  isDesktop: boolean;     // Desktop (> 1024px)
  isSmallScreen: boolean; // Both mobile and tablet (< 1024px)
}

export function useDevice(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo>({
    isMobile: false,
    isTablet: false, 
    isDesktop: true,
    isSmallScreen: false
  })

  React.useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth
      const isMobile = width < MOBILE_BREAKPOINT
      const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT
      const isDesktop = width >= TABLET_BREAKPOINT
      const isSmallScreen = width < TABLET_BREAKPOINT

      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isSmallScreen
      })
    }

    // Run on mount
    checkDeviceType()

    // Set up event listener
    window.addEventListener('resize', checkDeviceType)
    
    // Clean up
    return () => window.removeEventListener('resize', checkDeviceType)
  }, [])

  return deviceInfo
}

// Backward compatibility
export function useIsMobile() {
  const { isMobile } = useDevice()
  return isMobile
}
