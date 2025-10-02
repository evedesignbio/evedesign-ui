// import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Container,
  Group,
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
import { useViewportSize } from "@mantine/hooks";

const links = [
  { link: "/", label: "Start", requiresLogin: false },
  { link: "/results", label: "Results", requiresLogin: true },
  { link: "/docs", label: "Guide", requiresLogin: false },
];

// TODO: fix mobile nav
// TODO: fix centered
export function NavBar() {
  const { width: viewportWidth } = useViewportSize();
  // const [opened, { toggle }] = useDisclosure(false);
  // const [active, setActive] = useState(links[0].link);

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
        href={link.link}
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
        <Group gap={5}>{items}</Group>
        {/*<Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />*/}
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
              variant="subtle"
              color={"gray"}
              onClick={signOut}
              //rightSection={<IconLogout size={16} />}
            >
              <IconLogout size={16} />
            </ActionIcon>
          ) : null}
        </Group>
      </Container>
    </header>
  );
}
