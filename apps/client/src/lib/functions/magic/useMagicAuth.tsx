import { useContext } from "react";

import { MagicAuthContext, MagicAuthContextProps } from "./Context";

export const useMagicAuth = (): MagicAuthContextProps => {
  const context = useContext<MagicAuthContextProps>(MagicAuthContext);

  if (!context) {
    throw new Error(
      "MagicAuthProvider context is undefined, please verify you are calling useMagicAuth() as child of a <MagicAuthProvider> component."
    );
  }

  return context;
};
