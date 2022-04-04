import { PrivateKey } from '@textile/crypto'
import { ThreadID } from '@textile/threads-id'
import { encode } from 'varint'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pbkdf2Sync } = require('crypto-browserify')

export enum DeterministicThreadVariant {
  MetathreadThreadVariant = 'metathread',
}

export enum ThreadKeyVariant {
  metathreadVariant = 'metathreadV1',
}

/**
 * Builds a thread ID that's going to be the same every time for a given user key pair.
 * Used for example to store user-related metadata
 * @param identity The crypto identity that holds the private key
 * @param variant The deterministic thread variant
 */
export const getDeterministicThreadID = (
  identity: PrivateKey,
  variant: DeterministicThreadVariant = DeterministicThreadVariant.MetathreadThreadVariant
): ThreadID => {
  // We need the raw key, thus we use marshal() instead of bytes
  const pk = identity.privKey
  const keyLen = 32
  const v = ThreadID.Variant.Raw
  const encoder = new TextEncoder()
  const salt = encoder.encode(`threadID${variant}`)

  const derivedPk: Buffer = pbkdf2Sync(pk, salt, 256, keyLen, 'sha512')

  const bytes = Buffer.concat([
    Buffer.from(encode(ThreadID.V1)),
    Buffer.from(encode(v)),
    derivedPk,
  ])

  return new ThreadID(bytes)
}

export const getManagedThreadKey = (
  identity: PrivateKey,
  threadKeyVariant: ThreadKeyVariant
): Uint8Array => {
  const pk = identity.privKey
  const keyLen = 32
  const keyBytes = 32
  const encoder = new TextEncoder()
  const salt = encoder.encode(`threadKey${threadKeyVariant}`)

  const derivedPk: Buffer = pbkdf2Sync(pk, salt, 256, keyLen, 'sha512')

  return derivedPk.slice(0, keyBytes * 2)
}
