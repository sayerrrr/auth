import { createContext } from "react";

import type {
  LoginWithMagicLinkConfiguration,
  MagicUserMetadata,
} from "@magic-sdk/types";
export interface MagicAuthContextProps {
  loginWithMagicLink: (
    config: LoginWithMagicLinkConfiguration
  ) => Promise<string | null>;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
  metadata: MagicUserMetadata | null;
  attemptingReauthentication: boolean;
  magicDIDToken: string | null;
}

export const MagicAuthContext = createContext<MagicAuthContextProps>(
  undefined as any
);
