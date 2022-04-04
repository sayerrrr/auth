/* eslint-disable react/jsx-props-no-spreading */
import "lib/styles/globals.css";

import { ChakraProvider } from "@chakra-ui/react";
import { config } from "lib/config";
import { MagicAuthProvider } from "lib/functions/magic";
import Layout from "lib/layout";
import customTheme from "lib/styles/customTheme";
import Head from "next/head";

import type { AppProps } from "next/app";
const MyApp = ({ Component, pageProps }: AppProps) => {
  return (
    <MagicAuthProvider magicApiKey={config.key as string}>
      <ChakraProvider theme={customTheme}>
        <Head>
          <meta
            name="viewport"
            content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover"
          />
        </Head>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </ChakraProvider>
    </MagicAuthProvider>
  );
};

export default MyApp;
