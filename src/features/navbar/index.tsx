// import { useState } from "react";
import { Container, Group } from "@mantine/core";
// import { useDisclosure } from "@mantine/hooks";
import { Link } from "wouter";
import "./index.css";

const links = [
  { link: "/", label: "Start" },
  { link: "/results", label: "Previous jobs" },
];

// TODO: fix mobile nav
// TODO: fix centered
export function NavBar() {
  // const [opened, { toggle }] = useDisclosure(false);
  // const [active, setActive] = useState(links[0].link);

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

  return (
    <header className="header">
      <Container fluid className="inner">
        <Group gap={5}>{items}</Group>
        {/*<Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />*/}
      </Container>
    </header>
  );
}
