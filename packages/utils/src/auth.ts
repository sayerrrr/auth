import { PrivateKey } from '@textile/crypto'
import * as ws from '@hapi/nes'
import { v4 } from 'uuid'
import { request } from './request'

export interface TextileStorageAuth {
  key: string
  token: string
  sig: string
  msg: string
}

export interface HubAuthResponse {
  token: string
  storageAuth?: TextileStorageAuth
}

export const authenticate = async (
  endpoint: string,
  identity: PrivateKey
): Promise<HubAuthResponse> => {
  const pubKey = identity.public.toString()

  const subscription = '/token/' + pubKey
  const socket = new ws.Client(endpoint)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post = async ({ data }: { data: any }) =>
    request({
      url: 'api/challenge',
      data: data,
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

  socket.onConnect = () =>
    socket.message(
      JSON.stringify({
        data: { id: v4(), pubkey: pubKey, version: 2 },
        type: 'token',
      })
    )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = async (event: any) => {
    const data = JSON.parse(event || '{}')

    switch (data.type) {
      case 'error': {
        break
      }

      case 'challenge': {
        const buf = Buffer.from(data.value.data)
        const signed = await identity.sign(buf)

        await post({
          data: JSON.stringify({
            action: 'challenge',
            data: {
              pubkey: pubKey,
              sig: Buffer.from(signed).toString('base64'),
            },
          }),
        })

        break
      }

      case 'token': {
        socket.disconnect()
        return data.value
      }
    }
  }

  await socket.connect()

  return await socket.subscribe(subscription, handler)
}
