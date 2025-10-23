import { useViewportSize } from "@mantine/hooks";

export const LARGE_SCREEN_MIN_WIDTH = 800;

// enhanced hook for determining desktop vs mobile rendering view
export const useViewportProperties = () => {
  const screenSize = useViewportSize();
  const isDesktop = screenSize.width >= LARGE_SCREEN_MIN_WIDTH;
  const isDesktopSmall = isDesktop && screenSize.width < 1200;

  return {
    screenSize: screenSize,
    isDesktop: isDesktop,
    isDesktopSmall: isDesktopSmall,
  };
};
