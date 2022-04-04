export interface CreateIdentityInput {
  publicKey: string
  email?: string
  username?: string
  provider?: string
  address?: string
  name?: string
}

export interface CreateProofInput {
  // The type of proof
  type: ProofType

  // The value of the proof. E.g. if this is an email proof, the value would be the actual email
  value: string

  // The username of the user this proof belongs to
  uuid: string
}

export enum GetIdentityQueryType {
  email = 'email',
}

export interface GetIdentitiesQuery {
  type: GetIdentityQueryType
  value: string
}

export enum ProofType {
  email = 'email',
}

export interface Identity {
  /**
   * Sign the message using this identity and return the signature.
   * @param data The data (raw bytes) to sign.
   */
  sign(data: Uint8Array): Promise<Uint8Array>

  /**
   * Raw private key bytes of this identity
   *
   */
  privKey: Uint8Array

  /**
   * Get the public key associated with this identity. This can be any object
   * that satisfies the {@link Public} interface.
   */
  public: Public
}

export interface Public {
  /**
   * Verifies the signature for the data and returns true if verification
   * succeeded or false if it failed.
   * @param data The data to use for verification.
   * @param sig The signature to verify.
   */
  verify(data: Uint8Array, sig: Uint8Array): Promise<boolean>

  /**
   * Raw public keys bytes
   */
  pubKey: Uint8Array

  /**
   * Return the protobuf-encoded bytes of this public key.
   */
  bytes: Uint8Array
}
