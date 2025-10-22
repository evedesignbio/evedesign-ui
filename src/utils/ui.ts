import { useViewportSize } from "@mantine/hooks";
import imgUrl from "../assets/background_image.jpg";
import { CSSProperties } from "react";

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

export const BACKGROUND_IMAGE_STYLE = (colorScheme: "light" | "dark") => {
  return {
    position: "fixed",
    top: 0,
    height: "100vh",
    width: "100vw",
    backgroundImage: `url(${imgUrl})`,
    opacity: colorScheme === "dark" ? 0.4 : 0.2,
    backgroundAttachment: "fixed",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    zIndex: -1,
  } as CSSProperties;
};
