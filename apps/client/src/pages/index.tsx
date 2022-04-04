import {
  Flex,
  Box,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Button,
  useColorModeValue,
} from "@chakra-ui/react";
import { useMagicAuth } from "lib/functions/magic";
import { useState } from "react";

export default function Main() {
  const {
    isLoggedIn,
    metadata,
    attemptingReauthentication,
    logout,
    loginWithMagicLink,
  } = useMagicAuth();

  const [emailValue, setEmailValue] = useState<string>("");

  if (attemptingReauthentication) {
    return <div>Attempting to reauthenticate user...</div>;
  }

  if (isLoggedIn) {
    return (
      <div>
        Hello {metadata?.email} <br />
        <button onClick={logout}>Log out</button>
      </div>
    );
  }

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginWithMagicLink({ email: "test+success@magic.link", showUI: false });
  };

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bg={useColorModeValue("gray.50", "gray.800")}
    >
      <Stack spacing={8} mx="auto" maxW="xl" py={12} px={6}>
        <Box
          rounded="lg"
          bg={useColorModeValue("white", "gray.700")}
          boxShadow="lg"
          p={8}
        >
          <Stack spacing={4}>
            <FormControl id="email">
              <FormLabel>Email address</FormLabel>
              <Input
                type="email"
                onChange={(e) => setEmailValue(e.target.value)}
              />

              <Button
                bg="blue.400"
                color="white"
                my="4"
                type="submit"
                _hover={{
                  bg: "blue.500",
                }}
                onClick={handleLoginSubmit}
              >
                Sign in
              </Button>
            </FormControl>
          </Stack>
        </Box>
      </Stack>
    </Flex>
  );
}
