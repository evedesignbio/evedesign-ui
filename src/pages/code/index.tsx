import { Card, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconBrandGithubFilled } from "@tabler/icons-react";

const CODE_REPOS = [
  {
    name: "evedesign",
    description: "Core framework for biomolecular design",
    url: "https://github.com/evedesignbio/evedesign",
  },
  {
    name: "evedesign-server",
    description: "REST API and declarative pipeline execution",
    url: "https://github.com/evedesignbio/evedesign-server",
  },
  {
    name: "evedesign-ui",
    description: "Interactive user interface for evedesign",
    url: "https://github.com/evedesignbio/evedesign-ui",
  },
  {
    name: "evmutation2",
    description: "EVmutation2 generative evolutionary protein sequence model",
    url: "https://github.com/evedesignbio/evmutation2",
  },
];

export const CodePage = () => {
  return (
    <Container size={"sm"} mt={"xl"}>
      <Stack>
        {" "}
        {CODE_REPOS.map((repo, idx) => {
          return (
            <Card
              key={idx}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              component="a"
              href={repo.url}
              target="_blank"
              rel="noreferrer"
            >
              <Group>
                <IconBrandGithubFilled size={40} />
                <Stack gap={"xs"}>
                  <Title order={2}>{repo.name}</Title>
                  <Text>{repo.description}</Text>
                </Stack>
              </Group>
            </Card>
          );
        })}
      </Stack>
    </Container>
  );
};
