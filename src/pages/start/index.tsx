import { BACKGROUND_IMAGE_STYLE } from "../../utils/ui.ts";
import {
  Button,
  Container,
  Group,
  Title,
  Text,
  List,
  ThemeIcon,
  Stack,
  Menu,
  Anchor,
} from "@mantine/core";
import { Link, useLocation } from "wouter";
import {
  useSession,
  signIn,
  PUBLIC_ACCOUNT_EMAIL,
  PUBLIC_ACCOUNT_PW,
} from "../../context/SessionContext.tsx";
import {
  IconBook,
  IconBrandGithubFilled,
  IconBrandSlack,
  IconCheck, IconMail,
} from "@tabler/icons-react";

const EXAMPLE_DESIGN_JOB_URL = "/results/04e6f544-4eed-40b0-a698-aea8fdd67d1c";
const EXAMPLE_SCAN_JOB_URL = "/results/961caf35-5c23-49fd-81ef-2d1b6f37e13b";

export const StartPage = () => {
  const [_location, navigate] = useLocation();
  const { session } = useSession();

  const navigateToExample = (url: string) => {
    if (!session) {
      signIn(PUBLIC_ACCOUNT_EMAIL, PUBLIC_ACCOUNT_PW).then(() => navigate(url));
    } else {
      navigate(url);
    }
  };

  return (
    <>
      <div style={BACKGROUND_IMAGE_STYLE} />
      <Container size={"sm"}  mt={"xl"}>
        <Stack align={"center"}>
          <Title size={50} fw={600}>
            Protein design{" "}
            <span
              style={{
                // backgroundColor: "var(--mantine-color-blue-light)",
                // borderRadius: "var(--mantine-radius-sm)",
                // padding: "4px 12px",
                color:
                  "light-dark(var(--mantine-color-blue-6), var(--mantine-color-blue-4))",
              }}
            >
              for the community
            </span>
          </Title>
          <Text c={"dimmed"} size={"xl"}>
            Design your protein sequences end-to-end starting from your target
            protein, analyze your library interactively and export
            codon-optimized nucleotide sequences for experimental testing.
          </Text>

          <List
            mt={30}
            spacing="sm"
            size="md"
            icon={
              <ThemeIcon size={20} radius="xl">
                <IconCheck size={12} stroke={1.5} />
              </ThemeIcon>
            }
          >
            <List.Item>
              <b>Free design jobs</b> – we provide the computing free of charge
              for academic/non-commercial research, no registration required.
            </List.Item>
            <List.Item>
              <b>Open source</b> – backed by a unified framework for biosequence
              design (will be released shortly under a permissive license)
            </List.Item>
            <List.Item>
              <b>Interactive analysis</b> – curate your generated sequence
              library in the context of 3D structures and natural sequences
            </List.Item>
          </List>

          <Group mt={30}>
            <Button
              // component="a"
              disabled={true}
              size={"lg"}
              variant="default"
              leftSection={<IconBrandGithubFilled size={20} />}
            >
              <Stack gap={0}>
                GitHub<Text size={"xs"}>(coming soon)</Text>
              </Stack>
            </Button>
            <Menu shadow="md" width={200} position="bottom-start">
              <Menu.Target>
                <Button variant={"default"} size={"lg"}>
                  View example results
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  onClick={() => navigateToExample(EXAMPLE_DESIGN_JOB_URL)}
                >
                  <Text size={"md"}>Full redesign</Text>
                </Menu.Item>
                <Menu.Item
                  onClick={() => navigateToExample(EXAMPLE_SCAN_JOB_URL)}
                >
                  <Text size={"md"}>Mutation scan</Text>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <Button
              component={Link}
              to="/submit"
              size={"lg"}
              // leftSection={<IconCircleArrowRight size={20} />}
            >
              Create designs
            </Button>
          </Group>
          <Stack mt={50}>
            <Group>
              <Button
                  variant={"subtle"}
                  component={Link}
                  to={"/docs"}
                  leftSection={<IconBook size={20} />}
              >
                Read documentation
              </Button>
              <Button
                variant={"subtle"}
                component={"a"}
                href={
                  "https://join.slack.com/t/proteindesignserver/shared_invite/zt-3drh3n2hu-DWimoMTE9dyHtBhFViYh4g"
                }
                target={"_blank"}
                leftSection={<IconBrandSlack size={20} />}
              >
                Community slack for support
              </Button>
              <Button
                  variant={"subtle"}
                  component={"a"}
                  href={
                    "mailto:hello@evedesign.bio"
                  }
                  leftSection={<IconMail size={20} />}
              >
                Contact the team
              </Button>
            </Group>
            <Text size={"sm"} c={"dimmed"}>
              Developed by{" "}
              <Anchor
                c={"dimmed"}
                target="_blank"
                href={"https://deboramarkslab.com"}
              >
                Debora Marks Lab
              </Anchor>
              ,{" "}
              <Anchor
                c={"dimmed"}
                target="_blank"
                href={"https://thomashopf.com"}
              >
                Thomas Hopf Scientific Consulting
              </Anchor>
              {", "}
              <Anchor
                c={"dimmed"}
                target="_blank"
                href={"https://steineggerlab.com/"}
              >
                Martin Steinegger Lab
              </Anchor>
              {", and "}
              <Anchor
                c={"dimmed"}
                target="_blank"
                href={"https://synbiohive.org/"}
              >
                Synthetic Biology HIVE
              </Anchor>
            </Text>
          </Stack>
        </Stack>
      </Container>
    </>
  );
};
