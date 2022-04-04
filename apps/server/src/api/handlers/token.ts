import Hapi from '@hapi/hapi'
import ws from '@hapi/nes'
import b from '@hapi/bourne'
import { Identity, Signature } from '@prisma/client'
import multibase from 'multibase'
import { defer, lastValueFrom } from 'rxjs'
import { catchError, map, take } from 'rxjs/operators'

import { config } from '../../config'
import { signJWT } from '../../lib/jwt'
import { log } from '../../lib/log'
import { createHubClient, getAPISig } from '../../lib/textile'
import { IdentityModel, SignatureModel } from '../../models'
import { fromString } from 'uint8arrays/from-string'

interface TokenRequestPayload {
  data: { id: string; pubkey: string; version?: number }
}

interface AuthContext {
  uuid: string
  pubkey: string
}

/* env */
const STAGE = config.API.ENV

/* models */
const sigDb = new SignatureModel(STAGE)
const identityDb = new IdentityModel(STAGE)

/* route */
export const token = {
  name: 'token',
  register: async (s: Hapi.Server) => {
    s.register({
      plugin: ws,
      options: {
        onMessage: onMessage,
        auth: false,
        headers: ['Content-Type'],
      },
    })

    s.subscription('/token/{pubkey}')
  },
}

/* handler */
const onMessage = async (s: ws.Socket, event) => {
  const {
    data: { pubkey, version },
  } = b.parse(event) as TokenRequestPayload

  try {
    if (!pubkey) {
      throw new Error(
        'Missing param: ' +
          JSON.stringify({
            pubkey: pubkey ?? 'missing',
          })
      )
    }

    const wait = (pk) =>
      lastValueFrom(
        defer(() => sigDb.getSignatureByPublicKey(pk)).pipe(
          catchError((_, caught) => caught),
          map(async (v) => {
            await sigDb.deleteSignatureByPublicKey(v.publicKey)

            try {
              return Buffer.from(fromString(v.sig, 'base64'))
            } catch (e) {
              console.log('error on row decoding')
              console.log(e)
            }

            return Buffer.from(v.sig, 'base64')
          }),
          catchError((_, caught) => caught),
          take(10)
        )
      )

    const hub = await createHubClient()
    let token

    try {
      token = await hub.getTokenChallenge(
        pubkey,
        async (challenge: Uint8Array) => {
          const payload = {
            type: 'challenge',
            value: Buffer.from(challenge).toJSON(),
          }

          s.publish('/token/' + pubkey, JSON.stringify(payload))

          return await wait(pubkey)
        }
      )
    } catch (e) {}

    // log('token: ', token)

    //   const hexPubKey = Buffer.from(multibase.decode(pubkey))
    //     .toString('hex')
    //     .substring(-64)
    //   const user = ((await identityDb.getIdentityByPublicKey(hexPubKey)) ??
    //     (await identityDb.insert({
    //       publicKey: hexPubKey,
    //     }))) as Identity
    //   const authPayload: AuthContext = {
    //     pubkey: hexPubKey,
    //     uuid: user.uuid,
    //   }
    //   const jwt = await signJWT(authPayload)
    //   const auth = await getAPISig(24 * 3600)
    //   const storageAuth = {
    //     ...auth,
    //     token,
    //     key: process.env.TXL_USER_KEY,
    //   }
    //   let payload
    //   if (version && version === 2) {
    //     payload = {
    //       token: jwt,
    //       storageAuth,
    //     }
    //   } else {
    //     payload = { ...storageAuth, token: jwt }
    //   }
    //   await s.publish(
    //     '/challenge/' + pubkey,
    //     JSON.stringify({
    //       type: 'token',
    //       value: payload,
    //     })
    //   )
  } catch (e: any) {
    log('error on token request: ', e)

    await s.publish(
      '/token/' + pubkey,
      JSON.stringify({
        type: 'error',
        value: e,
      })
    )
  }
}
