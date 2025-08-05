// import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  useComputedColorScheme,
} from "@mantine/core";
// import { useDisclosure } from "@mantine/hooks";
import { Link } from "wouter";
import "./index.css";
import { signOut, useSession } from "../../context/SessionContext.tsx";
import { IconLogout, IconSun, IconMoon } from "@tabler/icons-react";
import { useMantineColorScheme } from "@mantine/core";
import { useBalance } from "../../api/backend.ts";

const links = [
  { link: "/", label: "Start" },
  { link: "/results", label: "Previous jobs" },
];

// TODO: fix mobile nav
// TODO: fix centered
export function NavBar() {
  // const [opened, { toggle }] = useDisclosure(false);
  // const [active, setActive] = useState(links[0].link);

  const { session } = useSession();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const balance = useBalance();

  const items = links.map((link) => (
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
      Credit:{" "}
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
            <Button
              variant="subtle"
              color={"gray"}
              onClick={signOut}
              rightSection={<IconLogout size={16} />}
            >
              Sign out
            </Button>
          ) : null}
        </Group>
      </Container>
    </header>
  );
}
