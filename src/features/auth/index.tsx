import {
  Alert,
  Anchor,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import React, { useState } from "react";
import {
  PUBLIC_ACCOUNT_EMAIL,
  PUBLIC_ACCOUNT_PW,
  signIn,
} from "../../context/SessionContext.tsx";
import { IconExclamationCircle } from "@tabler/icons-react";
import { Link } from "wouter";

interface AuthenticationFormProps {
  title?: string;
}

export const AuthenticationForm = ({
  title = undefined,
}: AuthenticationFormProps) => {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const executeLogin = async (user: string, pw: string) => {
    setLoading(true);
    const { error } = await signIn(user, pw);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await executeLogin(userName, password);
  };

  return (
    <Container size={"xs"} mt={"xl"}>
      <Stack gap={0}>
        {title ? <Title ta="left">{title}</Title> : null}

        <Button
          fullWidth
          mt="xl"
          radius="md"
          type={"submit"}
          onClick={() => executeLogin(PUBLIC_ACCOUNT_EMAIL, PUBLIC_ACCOUNT_PW)}
          disabled={loading}
        >
          Use public access (no registration needed)
        </Button>

        <Divider
          label="Or log in with your own account"
          labelPosition="center"
          mt="lg"
        />

        <Paper withBorder shadow="sm" p={22} mt={20} radius="md">
          <form onSubmit={handleSubmit}>
            <TextInput
              label="Email"
              placeholder="Your email address"
              required
              radius="md"
              value={userName}
              onChange={(event) => setUserName(event.currentTarget.value)}
              disabled={loading}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              mt="md"
              radius="md"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              disabled={loading}
            />
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
              mt="lg"
              radius="md"
              type={"submit"}
              disabled={loading}
            >
              Sign in
            </Button>
          </form>
          <Group justify="space-between" mt="lg">
            <Anchor to="/auth/sign-up" component={Link}>
              Create account
            </Anchor>
            <Anchor to="/auth/reset-password" component={Link}>
              Forgot password?
            </Anchor>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
};
