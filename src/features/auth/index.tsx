import {
  Alert,
  Button,
  Container,
  Divider,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import React, { useState } from "react";
import { signIn } from "../../context/SessionContext.tsx";
import { IconExclamationCircle } from "@tabler/icons-react";

const PUBLIC_ACCOUNT_EMAIL = "evcouplingsnotifications@gmail.com";
const PUBLIC_ACCOUNT_PW = "rQYlsSeMx67eNSDXUpXYUnQxGFBmpPbKVlUqHmS5xIlssqrGkL";

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
    <Container size={"sm"}>
      <Stack gap={0}>
        {title ? <Title ta="left">{title}</Title> : null}
        {/*<Blockquote color="blue" mt="md">*/}
        {/*  By logging in you agree to only use the server for academic or*/}
        {/*  non-commercial research purposes. Please use the public access account*/}
        {/*  in a responsible way and do not submit jobs in bulk so all users get*/}
        {/*  their fair share.*/}
        {/*</Blockquote>*/}

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

            {/*<Group justify="space-between" mt="lg">*/}
            {/*  <Anchor component="button" size="sm">*/}
            {/*    Create account*/}
            {/*  </Anchor>*/}
            {/*  <Anchor component="button" size="sm">*/}
            {/*    Forgot password?*/}
            {/*  </Anchor>*/}
            {/*</Group>*/}

            <Button
              fullWidth
              mt="lg"
              radius="md"
              type={"submit"}
              // loading={loading}
              disabled={loading}
            >
              Sign in
            </Button>
          </form>
        </Paper>
      </Stack>
    </Container>
  );
};
