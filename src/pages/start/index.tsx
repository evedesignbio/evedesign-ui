import { BACKGROUND_IMAGE_STYLE } from "../../utils/ui.ts";
import {
  Button,
  Container,
  Group,
  Title,
  Text,
  Stack,
  Menu,
  Anchor,
  Image,
  Tooltip,
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
  IconMail,
} from "@tabler/icons-react";
import { LegalLinks } from "../legal";
import LogoMarks from "../../assets/marks_lab.png";
import LogoHopf from "../../assets/hopf_consulting.png";
import LogoDOelsnitz from "../../assets/doelsnitz_lab.png";
import LogoSteinegger from "../../assets/steinegger_lab.png";

const EXAMPLE_DESIGN_JOB_URL = "/results/a25685df-6bd6-4272-a715-1ee5b1b47434";
const EXAMPLE_SCAN_JOB_URL = "/results/969d9fe8-b658-4dd0-9f0c-7826d468f681";

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
const shuffleArray = (array: any[]) => {
  const arrayShuffled = [...array];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrayShuffled[i], arrayShuffled[j]] = [arrayShuffled[j], arrayShuffled[i]];
  }
  return arrayShuffled;
};

// shuffle once (not per rerender)
const CONTRIBUTORS = shuffleArray([
  "Simon d'Oelsnitz",
  "Martin Steinegger",
  "Artem Gazizov",
  "Sergio Garcia Busto",
  "SunJae Lee",
  "Milot Mirdita",
  "Thomas Hopf",
  "Debora Marks",
  "Chris Sander",
  "Jake Reardon",
]);

const GROUPS = [
  {
    title: "Debora Marks Lab",
    logo: LogoMarks,
    link: "https://deboramarkslab.com",
  },
  {
    title: "Thomas Hopf Scientific Consulting",
    logo: LogoHopf,
    link: "https://thomashopf.com",
  },
  {
    title: "Martin Steinegger Lab",
    logo: LogoSteinegger,
    link: "https://steineggerlab.com",
  },
  {
    title: "Simon d'Oelsnitz Lab",
    logo: LogoDOelsnitz,
    link: "https://simondoelsnitz.com",
  },
];

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
      <Container size={"sm"} mt={"xl"}>
        <Stack align={"center"}>
          <Title size={50} fw={600}>
            AI protein design{" "}
            <span
              style={{
                // backgroundColor: "var(--mantine-color-blue-light)",
                // borderRadius: "var(--mantine-radius-sm)",
                // padding: "4px 12px",
                color:
                  "light-dark(var(--mantine-color-blue-6), var(--mantine-color-blue-4))",
              }}
            >
              for everyone
            </span>
            .
          </Title>
          <Text c={"dimmed"} size={"xl"}>
            Design your sequences end-to-end: input your target protein, analyze
            your generated library interactively, and export codon-optimized DNA
            sequences for experimental testing. All free and backed by an
            open-source framework.
          </Text>

          {/*<List*/}
          {/*  mt={30}*/}
          {/*  spacing="sm"*/}
          {/*  size="md"*/}
          {/*  icon={*/}
          {/*    <ThemeIcon size={20} radius="xl">*/}
          {/*      <IconCheck size={12} stroke={1.5} />*/}
          {/*    </ThemeIcon>*/}
          {/*  }*/}
          {/*>*/}
          {/*  <List.Item>*/}
          {/*    <b>Free design jobs</b> – we provide the computing free of charge*/}
          {/*    for academic/non-commercial research, no registration required.*/}
          {/*  </List.Item>*/}
          {/*  <List.Item>*/}
          {/*    <b>Open source</b> – backed by a unified framework for biosequence*/}
          {/*    design (will be released shortly under a permissive license)*/}
          {/*  </List.Item>*/}
          {/*  <List.Item>*/}
          {/*    <b>Interactive analysis</b> – curate your generated sequence*/}
          {/*    library in the context of 3D structures and natural sequences*/}
          {/*  </List.Item>*/}
          {/*</List>*/}

          <Group mt={30} align={"center"} justify={"center"}>
            {/*<Button*/}
            {/*  // component="a"*/}
            {/*  disabled={true}*/}
            {/*  size={"lg"}*/}
            {/*  variant="light"*/}
            {/*  leftSection={<IconBrandGithubFilled size={20} />}*/}
            {/*>*/}
            {/*  <Stack gap={0}>*/}
            {/*    GitHub<Text size={"xs"}>(coming soon)</Text>*/}
            {/*  </Stack>*/}
            {/*</Button>*/}
            <Menu shadow="md" width={200} position="bottom-start">
              <Menu.Target>
                <Button variant={"light"} size={"lg"}>
                  View example results
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  onClick={() => navigateToExample(EXAMPLE_DESIGN_JOB_URL)}
                >
                  <Text size={"md"}>Sequence generation</Text>
                </Menu.Item>
                <Menu.Item
                  onClick={() => navigateToExample(EXAMPLE_SCAN_JOB_URL)}
                >
                  <Text size={"md"}>Mutational scanning</Text>
                </Menu.Item>
                {session === null ? (
                  <Menu.Label>
                    You will be logged in with public access account
                  </Menu.Label>
                ) : null}
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
          <Stack mt={50} mb={30} align={"center"}>
            <Group align={"center"} justify={"center"}>
              <Button
                variant={"subtle"}
                component={Link}
                to={"/docs"}
                leftSection={<IconBook size={20} />}
              >
                Documentation
              </Button>
              <Button
                variant={"subtle"}
                component={Link}
                to={"/"}
                leftSection={<IconBrandGithubFilled size={20} />}
              >
                GitHub
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
                Community Slack
              </Button>
              <Button
                variant={"subtle"}
                component={"a"}
                href={"mailto:hello@evedesign.bio"}
                leftSection={<IconMail size={20} />}
              >
                Email us
              </Button>
            </Group>

            <Text c={"dimmed"} size={"sm"}>
              By using this service you agree to our <LegalLinks />
            </Text>

            <Group mt={30}>
              {GROUPS.map((g, i) => (
                <Tooltip label={g.title} key={i} offset={10}>
                  <Anchor target="_blank" href={g.link}>
                    <Image
                      src={g.logo}
                      style={{
                        filter:
                          "grayscale(70%) drop-shadow(0px 0px 1px #ffffff)",
                      }}
                      h={50}
                      w={"auto"}
                      fit={"contain"}
                    />
                  </Anchor>
                </Tooltip>
              ))}
            </Group>
            <Text c={"dimmed"} size={"sm"}>
              Contributors (in random order): {CONTRIBUTORS.join(", ")}
            </Text>
          </Stack>
        </Stack>
      </Container>
    </>
  );
};
