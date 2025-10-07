import { useViewportSize } from "@mantine/hooks";
import imgUrl from "../assets/background_image.jpg";
import {CSSProperties} from "react";

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

export const BACKGROUND_IMAGE_STYLE = {
  position: "absolute",
      top: 55,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `url(${imgUrl})`,
    opacity: 0.2,
    backgroundAttachment: "fixed",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    zIndex: -1,
} as CSSProperties;