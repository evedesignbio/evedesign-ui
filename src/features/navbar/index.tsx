// import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  ScrollArea,
  useComputedColorScheme,
} from "@mantine/core";
// import { useDisclosure } from "@mantine/hooks";
import { Link, useLocation } from "wouter";
import "./index.css";
import { signOut, useSession } from "../../context/SessionContext.tsx";
import { IconLogout, IconSun, IconMoon } from "@tabler/icons-react";
import { useMantineColorScheme } from "@mantine/core";
import { useBalance } from "../../api/backend.ts";
import { useHashLocation } from "wouter/use-hash-location";
import { useDisclosure, useViewportSize } from "@mantine/hooks";

const links = [
  { link: "/", label: "evedesign", requiresLogin: false },
  { link: "/submit", label: "Submit", requiresLogin: false },
  { link: "/results", label: "Results", requiresLogin: true },
  { link: "/docs", label: "Docs", requiresLogin: false },
];

export const NavBar = () => {
  const { width: viewportWidth } = useViewportSize();
  // const [opened, { toggle }] = useDisclosure(false);
  // const [active, setActive] = useState(links[0].link);
  const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] =
    useDisclosure(false);

  const { session } = useSession();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const balance = useBalance();

  // little hack to work around hash route update not working when link is clicked
  // (rather than using forward/backward buttons)
  const [hashLocation, hashNavigate] = useHashLocation();
  const [location, _] = useLocation();

  const items = links
    .filter((link) => !link.requiresLogin || session)
    .map((link) => (
      <Link
        key={link.label}
        to={link.link}
        className={"link"}
        // className={(active) => (active ? "link" : "link")}
        // data-active={true}  // TODO
        // data-active={active === link.link || undefined}
        // onClick={(event) => {
        //   event.preventDefault();
        //   setActive(link.link);
        // }}

        // trigger hash navigation event in case we are on same page but coming
        // from a different hash, or otherwise clicking the link does not have an effect
        onClick={(e) => {
          if (location === link.link && hashLocation !== "/") {
            hashNavigate("/");
            e.preventDefault();
          }
          closeDrawer();
        }}
      >
        {link.label}
      </Link>
    ));

  const balanceBadge = balance.finished ? (
    <Badge
      mr={10}
      variant={"dot"}
      color={balance.balance !== null && balance.balance > 0 ? "green" : "red"}
    >
      {viewportWidth > 500 ? "Credit: " : ""}
      {balance.balance !== null ? `$${balance.balance.toFixed(2)}` : "N/A"}
    </Badge>
  ) : null;

  return (
    <header className="header">
      <Container fluid className="inner">
        <Burger
          opened={drawerOpened}
          onClick={toggleDrawer}
          size={"sm"}
          hiddenFrom="sm"
          aria-label="Toggle navigation"
        />
        <Group gap={5} visibleFrom={"sm"}>
          {items}
        </Group>
        <Group gap={1}>
          {balanceBadge}
          <ActionIcon
            color={"gray"}
            variant="subtle"
            onClick={toggleColorScheme}
          >
            {computedColorScheme === "dark" ? (
              <IconSun size={16} />
            ) : (
              <IconMoon size={16} />
            )}
          </ActionIcon>
          {session ? (
            <ActionIcon
              visibleFrom={"sm"}
              variant="subtle"
              color={"gray"}
              onClick={signOut}
              //rightSection={<IconLogout size={16} />}
            >
              <IconLogout size={16} />
            </ActionIcon>
          ) : (
            <Group visibleFrom={"sm"} gap={0}>
              <Link to={"/submit"} className={"link"}>
                Log in
              </Link>
              {/*<Link to={"/auth/sign-up"} className={"link"}>*/}
              {/*  Sign up*/}
              {/*</Link>*/}
            </Group>
          )}
        </Group>
        <Drawer
          opened={drawerOpened}
          onClose={closeDrawer}
          size="100%"
          padding="md"
          title={null}
          hiddenFrom="sm"
          zIndex={1000000}
        >
          <ScrollArea h="calc(100dvh - 100px)" mx="-md">
            <Divider />
            {items}
            <Divider my="sm" />
            <Group justify="center" grow pb="xl" px={"sm"}>
              {session ? (
                <Button onClick={() => signOut().then(closeDrawer)}>
                  Log out
                </Button>
              ) : (
                <>
                  <Button
                    component={Link}
                    to={"/submit"}
                    onClick={closeDrawer}
                    variant={"filled"}
                  >
                    Log in
                  </Button>
                  {/*<Button*/}
                  {/*  component={Link}*/}
                  {/*  to={"/auth/sign-up"}*/}
                  {/*  onClick={closeDrawer}*/}
                  {/*  variant={"filled"}*/}
                  {/*>*/}
                  {/*  Sign up*/}
                  {/*</Button>*/}
                </>
              )}
            </Group>
          </ScrollArea>
        </Drawer>
      </Container>
    </header>
  );
};
