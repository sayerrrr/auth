import * as ws from "@hapi/nes"
import { request } from "@resource/utils"
import { ethers } from "ethers"
import { config } from "lib/config"
import { v4 } from "uuid"
import { getMagicInstance } from "../magic/magic"

type AuthEvent = {
  type: string
  value: string
}

export const useCheckExistingUser = () => {
  const s = new ws.Client(config.API.WS_AUTH_URL)

  const verifyExisting = (
    pubKey: string
  ): Promise<{
    identityExists: boolean
  }> =>
    new Promise(async (resolve, reject) => {
      await s.connect()

      const magic = await getMagicInstance()
      const signer = new ethers.providers.Web3Provider(
        magic.rpcProvider as any
      ).getSigner()

      s.onConnect = () =>
        s.message(
          JSON.stringify({
            data: { id: v4(), pubkey: pubKey, version: 2 },
            type: "token",
          })
        )

      const handler = async (event: any) => {
        const data: AuthEvent = JSON.parse(event || "{}")

        switch (data.type) {
          case "error": {
            reject({
              identityExists: false,
            })
            break
          }

          case "challenge": {
            const sig = await signer.signMessage(data.value)

            await post({
              data: JSON.stringify({
                action: "challenge",
                data: {
                  pubkey: pubKey,
                  sig: sig,
                },
              }),
            })

            break
          }

          case "token": {
            s.disconnect()
            resolve({
              identityExists: true,
            })
            break
          }
        }
      }

      return await s.subscribe("/token/" + pubKey, handler)
    })

  return { verify: verifyExisting }
}

const post = async ({ data }: { data: any }) =>
  request({
    url: "api/challenge",
    data: data,
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  })
