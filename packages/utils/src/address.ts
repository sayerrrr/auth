import { publicKeyBytesFromString } from '@textile/crypto'
import { PublicKey } from '@textile/hub'
import { SHA3 } from 'sha3'

// Standard FIPS 202 SHA-3 implementation (not keccak)
export const getAddressFromPublicKey = (pubkey: string): string => {
  const pubkeyb = publicKeyBytesFromString(pubkey)
  const hasher = new SHA3(256)
  const hexHash = hasher
    .update(Buffer.from(pubkeyb).toString('hex'), 'hex')
    .digest('hex')
  const trimmed = hexHash.slice(28)
  return `0x${trimmed}`
}

/**
 * Obtains an address given a public key
 * @param pubKey The public key (in hex encoding)
 */
export const deriveAddressFromPubKey = (pubKey: string): string => {
  const hash = new SHA3(256)

  // Compute the SHA3-256 hash of the public key
  hash.update(pubKey, 'hex')

  // Get the hex representation of the SHA3-256 hash
  const hexHash = hash.digest('hex')

  // Drop the first 14 bytes (28 characters)
  const trimmedHash = hexHash.substring(28)

  return `0x${trimmedHash}`
}

export const isValidAddress = (address: string): boolean => {
  const regex = /^0x[0-9A-Fa-f]{36}$/
  if (address.match(regex)) {
    return true
  }

  return false
}

const isPkHex = (input: string): boolean => {
  const re = /[0-9A-Fa-f]{64}/g
  return re.test(input)
}

/**
 * Tries to generate a ed25519 public key from the string input
 *
 * It supports multibase and hex as input
 */
export const tryParsePublicKey = (pk: string): PublicKey => {
  const keyLength = 32
  if (isPkHex(pk)) {
    return new PublicKey(Buffer.from(pk, 'hex').slice(0, keyLength))
  }

  const key = PublicKey.fromString(pk)
  if (key.pubKey.byteLength !== keyLength) {
    throw new Error(`invalid public key: ${pk}`)
  }

  return key
}
