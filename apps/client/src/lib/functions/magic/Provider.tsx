import type {
  MagicSDKAdditionalConfiguration,
  SDKBase,
} from "@magic-sdk/provider"; // Types
import type {
  LoginWithMagicLinkConfiguration,
  MagicUserMetadata,
} from "@magic-sdk/types";
import { Magic } from "magic-sdk";
import type React from "react";
import { useState } from "react";
import useDeepCompareEffect from "use-deep-compare-effect";
import { toUtf8Bytes, keccak256, arrayify } from "ethers/lib/utils";
import { BigNumber } from "ethers";
import { PrivateKey } from "@textile/hub";

import { MagicAuthContext } from "./Context";
import invariant from "tiny-invariant";

let magicInstance: SDKBase;

/**
 * Necessary because Magic uses the window object, which isn't available when nextjs is server-side-rendering
 *
 * To solve this, we just init magic lazily
 */
const getMagicInstance = (
  magicApiKey: string,
  magicOptions?: MagicSDKAdditionalConfiguration
): SDKBase => {
  if (!magicInstance) {
    magicInstance = new Magic(magicApiKey, {
      ...magicOptions,
      testMode: true,
    });
  }

  return magicInstance;
};

export default function MagicAuthProvider({
  children,
  magicApiKey,
  magicOptions = {},
}: {
  children: React.ReactNode;
  magicApiKey: string;
  magicOptions?: MagicSDKAdditionalConfiguration;
}): JSX.Element {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [magicDIDToken, setmagicDIDToken] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MagicUserMetadata | null>(null);
  const [attemptingReauthentication, setAttemptingReauthentication] =
    useState<boolean>(false);

  const createPK = (token: string): PrivateKey | null => {
    invariant(token, "token is required");

    const pk = PrivateKey.fromRawEd25519Seed(
      arrayify(keccak256(toUtf8Bytes(token)))
    );

    return pk;
  };

  const loginWithMagicLink = async (
    config: LoginWithMagicLinkConfiguration
  ) => {
    let jwt;

    try {
      if (await getMagicInstance(magicApiKey, magicOptions).user.isLoggedIn()) {
        jwt = await getMagicInstance(
          magicApiKey,
          magicOptions
        ).user.getIdToken();

        await createPK(config && config.email);
      } else {
        jwt = await getMagicInstance(
          magicApiKey,
          magicOptions
        ).auth.loginWithMagicLink(config);
        await createPK(config && config.email);
      }
    } catch (e) {
      console.error("Error getting magic jwt", e);
      return null;
    }

    setIsLoggedIn(true);
    setmagicDIDToken(jwt || "");

    const metadata = await getMagicInstance(
      magicApiKey,
      magicOptions
    ).user.getMetadata();

    setMetadata(metadata);

    return jwt || "";
  };

  const logout = async () => {
    await getMagicInstance(magicApiKey, magicOptions).user.logout();
    setIsLoggedIn(false);
    setmagicDIDToken(null);
    setMetadata(null);
  };

  // Attempt to re-authenticate the magic user automatically on init - magic sessions are good for 7 days https://magic.link/docs/client-sdk/web/examples/reauthenticating-users
  useDeepCompareEffect(() => {
    setAttemptingReauthentication(true);
    (async () => {
      const magicInstance = getMagicInstance(magicApiKey, magicOptions);

      let alreadyLoggedIn: boolean;
      try {
        alreadyLoggedIn = await magicInstance.user.isLoggedIn();
      } catch (e) {
        console.error("Caught error attempting to reauthenticate user.", e);
        alreadyLoggedIn = false;
      }

      if (alreadyLoggedIn) {
        const jwt = await magicInstance.user.getIdToken();
        setIsLoggedIn(true);
        setmagicDIDToken(jwt);
        const metadata = await magicInstance.user.getMetadata();
        setMetadata(metadata);
      }

      setAttemptingReauthentication(false);
    })();
  }, [magicApiKey, magicOptions]); // magicApiKey and magicOptions are technically dependencies but should never change. Proper handling of a config that changes would require some teardown

  return (
    <MagicAuthContext.Provider
      value={{
        isLoggedIn,
        metadata,
        magicDIDToken,
        loginWithMagicLink,
        logout,
        attemptingReauthentication,
      }}
    >
      {children}
    </MagicAuthContext.Provider>
  );
}
