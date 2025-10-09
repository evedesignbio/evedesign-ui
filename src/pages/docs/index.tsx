import Markdown from "markdown-to-jsx";
import docString from "./documentation.md?raw";
import {
  Anchor,
  Container,
  Flex,
  TableOfContents,
  useComputedColorScheme,
} from "@mantine/core";

export const DocumentationPage = () => {
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  return (
    <Container size={"lg"}>
      <Flex columnGap={20}>
        <Markdown options={{ overrides: { a: Anchor } }}>{docString}</Markdown>

        <TableOfContents
          visibleFrom={"md"}
          variant="filled"
          size="sm"
          radius="0"
          mt={"xl"}
          getControlProps={({ data }) => ({
            onClick: () => data.getNode().scrollIntoView(),
            children: data.value,
          })}
          style={{
            position: "sticky",
            top: 60,
            minWidth: 400,
            // https://stackoverflow.com/questions/44446671/my-position-sticky-element-isnt-sticky-when-using-flexbox
            alignSelf: "flex-start",
            borderLeft:
              computedColorScheme === "dark"
                ? "1px solid rgba(255, 255, 255, 0.2)"
                : "1px solid rgba(0, 0, 0, 0.2)",
          }}
        />
      </Flex>
    </Container>
  );
};
