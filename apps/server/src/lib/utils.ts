import { publicKeyBytesFromString } from '@textile/crypto'
import { PublicKey } from '@textile/hub'
import { SHA3 } from 'sha3'

export const getAddressFromPublicKey = (pubkey: string): string => {
  const pubkeyb = publicKeyBytesFromString(pubkey)
  const hasher = new SHA3(256)
  const hexHash = hasher
    .update(Buffer.from(pubkeyb).toString('hex'), 'hex')
    .digest('hex')
  const trimmed = hexHash.slice(28)
  return `0x${trimmed}`
}

export const deriveAddressFromPubKey = (pubKey: string): string => {
  const hash = new SHA3(256)

  hash.update(pubKey, 'hex')

  const hexHash = hash.digest('hex')

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
