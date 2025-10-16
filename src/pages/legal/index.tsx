import Markdown from "markdown-to-jsx";
import privacyPolicyString from "./privacy_policy.md?raw";
import termsOfServiceString from "./terms_of_service.md?raw";
import { Anchor, Container, Title } from "@mantine/core";
import { Link } from "wouter";

export const PrivacyPolicyPage = () => {
  return (
    <Container size={"lg"} pt="xl">
      <Title>Privacy Policy</Title>
      <Markdown options={{ overrides: { a: Anchor } }}>
        {privacyPolicyString}
      </Markdown>
    </Container>
  );
};

export const TermsOfServicePage = () => {
  return (
    <Container size={"lg"} pt="xl">
      <Title>Terms of Service</Title>
      <Markdown options={{ overrides: { a: Anchor } }}>
        {termsOfServiceString}
      </Markdown>
    </Container>
  );
};

export const LegalLinks = () => {
  return (
    <>
      <Anchor component={Link} href={"/terms"}>
        Terms of Service
      </Anchor>
      {" and "}
      <Anchor component={Link} href={"/privacy"}>
        Privacy Policy
      </Anchor>
    </>
  );
};
