import {
  Alert,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import React, { useState } from "react";
import {
  resetPassword,
  updatePassword,
  signUp,
} from "../../context/SessionContext.tsx";
import { IconExclamationCircle } from "@tabler/icons-react";
import { LegalLinks } from "../legal";

interface GenericAccountPageProps {
  title: string;
  pageType: "reset-password" | "change-password" | "sign-up";
}

const TYPE_TO_BUTTON = {
  "reset-password": "Send recovery link",
  "change-password": "Update password",
  "sign-up": "Sign up",
};

const TYPE_TO_SUCCESS = {
  "reset-password": {
    title: "Please check your email",
    message: "Click recovery link to update your password.",
  },
  "change-password": {
    title: "Password updated",
    message: "Your password was successfully changed.",
  },
  "sign-up": {
    title: "Please check your email",
    message: "Click activation link to activate your account.",
  },
};

export const GenericAccountPage = ({
  title,
  pageType,
}: GenericAccountPageProps) => {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    let authError = null;

    if (pageType === "reset-password") {
      const { error } = await resetPassword(userName);
      authError = error;
    } else if (pageType === "change-password") {
      const { error } = await updatePassword(password);
      authError = error;
    } else if (pageType === "sign-up") {
      const { error } = await signUp(userName, password);
      authError = error;
    } else {
      throw new Error("Invalid type");
    }

    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setError("");
      setSuccess(true);
    }
  };

  const content = success ? (
    <Alert
      variant="light"
      color="blue"
      title={TYPE_TO_SUCCESS[pageType].title}
      mt={20}
      mb={20}
      icon={<IconExclamationCircle />}
    >
      {TYPE_TO_SUCCESS[pageType].message}
    </Alert>
  ) : (
    <Paper withBorder shadow="sm" p={22} mt={20} radius="md">
      <form onSubmit={handleSubmit}>
        {pageType === "reset-password" || pageType === "sign-up" ? (
          <TextInput
            label="Email"
            placeholder="Your email address"
            required
            radius="md"
            value={userName}
            onChange={(event) => setUserName(event.currentTarget.value)}
            disabled={loading}
          />
        ) : null}

        {pageType === "change-password" || pageType === "sign-up" ? (
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
        ) : null}

        {pageType === "sign-up" ? (
          <Text c={"dimmed"} size={"sm"} mt={"md"}>
            By signing up you agree to our <LegalLinks />
          </Text>
        ) : null}

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
          {TYPE_TO_BUTTON[pageType]}
        </Button>
      </form>
    </Paper>
  );

  return (
    <Container size={"xs"} mt={"xl"}>
      <Stack gap={0}>
        <Title ta="left">{title}</Title>
        {content}
      </Stack>
    </Container>
  );
};

export const ResetPasswordPage = () => {
  return (
    <GenericAccountPage title={"Reset password"} pageType={"reset-password"} />
  );
};

// note: this component *must* be wrapped in an auth-protected route!
export const ChangePasswordPage = () => {
  return (
    <GenericAccountPage
      title={"Change password"}
      pageType={"change-password"}
    />
  );
};

export const SignUpPage = () => {
  return <GenericAccountPage title={"Create account"} pageType={"sign-up"} />;
};
