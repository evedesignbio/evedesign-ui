import { Text, useComputedColorScheme } from "@mantine/core";
import imgUrl from "../../assets/background_image.jpg";

export const BackgroundImage = () => {
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          height: "100vh",
          width: "100vw",
          backgroundImage:
            computedColorScheme === "dark" ? `url(${imgUrl})` : "none",
          // opacity: computedColorScheme === "dark" ? 0.4 : 0.4,
          opacity: 0.4,
          backgroundAttachment: "fixed",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          zIndex: -1,
        }}
      />
      {computedColorScheme === "dark" ? (
        <div
          style={{
            position: "absolute",
            bottom: 5,
            right: 5,
            opacity: 0.7,
          }}
        >
          <Text c={"dimmed"} size={"xs"}>
            Image by freepik
          </Text>
        </div>
      ) : null}
    </>
  );
};
