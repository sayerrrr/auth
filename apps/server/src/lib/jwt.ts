import { createPrivateKey, createPublicKey } from 'crypto'
import { jwtVerify, SignJWT } from 'jose'
import config from '../config'

const josePrivateKey = () => {
  return createPrivateKey({
    key: Buffer.from(config.JWT.PRIVATE, 'base64'),
    format: 'der',
    type: 'pkcs8',
  })
}

export const josePublicKey = () => {
  return createPublicKey({
    key: Buffer.from(config.JWT.PUBLIC, 'base64'),
    format: 'der',
    type: 'spki',
  })
}

// stored in memory on the client --- used to determine logged in / not logged in
export const signJWT = async ({
  uuid,
  pubkey,
}: {
  uuid: string
  pubkey: string
}) => {
  return new SignJWT({ uuid, pubkey })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(josePrivateKey())
}

// client stores refresh token as a browser cookie, which persists between sessions.
// this is the ticket to get a new authToken to persist logged in state.
export const generateSignedRefreshToken = async (id: string) =>
  new SignJWT({ id })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(josePrivateKey())

export async function verifyToken(
  token?: string
): Promise<DecodedToken | null> {
  let decodedToken: DecodedToken | null

  try {
    if (!token) return null

    const { payload } = await jwtVerify(token, josePublicKey())
    const { uuid, pubkey } = payload

    if (!pubkey || !uuid) return null

    decodedToken = { uuid, pubkey } as DecodedToken
  } catch (e: any) {
    decodedToken = null
    if (e.code && !e.code.includes('ERR_JWT_EXPIRED')) {
      console.info('Error verifying jwt: ')
      console.error(e)
    }
  }

  return decodedToken
}

export interface DecodedToken {
  uuid: string
  pubkey: string
}
