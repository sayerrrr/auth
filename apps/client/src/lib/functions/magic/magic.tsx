import type {
  MagicSDKAdditionalConfiguration,
  SDKBase,
} from "@magic-sdk/provider" // Types
import { config } from "lib/config"
import { Magic } from "magic-sdk"

let magicInstance: SDKBase

const options = {
  network: {
    rpcUrl: "https://alfajores-forno.celo-testnet.org",
  },
}
const key = config.MAGIC.KEY as string

export const getMagicInstance = (
  magicApiKey: string = key,
  magicOptions: MagicSDKAdditionalConfiguration = options
): SDKBase => {
  if (!magicInstance) {
    magicInstance = new Magic(magicApiKey, {
      ...magicOptions,
      testMode: true,
    })
  }

  return magicInstance
}
