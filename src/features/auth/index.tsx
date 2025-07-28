import {
  Alert,
  Button,
  Container,
  Paper,
  PasswordInput,
  TextInput,
  Title,
} from "@mantine/core";
import React, { useState } from "react";
import { signIn } from "../../context/SessionContext.tsx";
import { IconExclamationCircle, IconInfoCircle } from "@tabler/icons-react";

export const AuthenticationForm = () => {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(userName, password);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setError("");
    }
  };

  return (
    <Container size={"sm"}>
      <Title ta="left">Please sign in to design!</Title>

      {/*<Text>*/}
      {/*  Do not have an account yet? <Anchor>Create account</Anchor>*/}
      {/*</Text>*/}

      <Alert variant="light" color="blue" title="Demo account" mt={20} icon={<IconInfoCircle />}>
        Please use the previously provided submission token as password
        <br />
        and username "demo@demo.com".
      </Alert>

      <Paper withBorder shadow="sm" p={22} mt={20} radius="md">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Email"
            placeholder="you@mantine.dev"
            required
            radius="md"
            value={userName}
            onChange={(event) => setUserName(event.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            mt="md"
            radius="md"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          {/*<Group justify="space-between" mt="lg">*/}
          {/*  /!*<Checkbox label="Remember me" />*!/*/}
          {/*  /!*<Anchor component="button" size="sm">*!/*/}
          {/*  /!*  Forgot password?*!/*/}
          {/*  /!*</Anchor>*!/*/}
          {/*</Group>*/}
          {error != "" ? (
            <Alert
              variant="light"
              color="blue"
              title="Error"
              mt={20}
              mb={20}
              icon={<IconExclamationCircle />}
            >
              {error}
            </Alert>
          ) : null}
          <Button
            fullWidth
            mt="xl"
            radius="md"
            type={"submit"}
            // loading={loading}
            disabled={loading}
          >
            Sign in
          </Button>
        </form>
      </Paper>
    </Container>
  );
};
