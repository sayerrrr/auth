import { NotFoundError } from '../errors'
import { get, post } from '../api'

export interface Signature {
  /**
   * Base32 encoded public key
   */
  publicKey: string

  /**
   * Challenge signed by private key
   */
  sig: string
}

export class SignatureModel {
  signature: string

  constructor() {
    this.signature = '/api/v1/signature'
  }

  public async createSignature(
    publicKey: string,
    sig: string
  ): Promise<Signature> {
    return await post({
      url: this.signature + '/upsert',
      data: {
        data: {
          where: {
            publicKey,
          },
          update: {
            sig,
          },
          create: {
            publicKey,
            sig,
          },
        },
      },
    }).then((res) => res.data)
  }

  public async getSignatureByPublicKey(publicKey: string): Promise<Signature> {
    const rawSig = await get({
      url: this.signature + '/get/key/' + publicKey,
      params: { sig: true, publicKey: true },
    }).then((res) => res.data)

    if (!rawSig) {
      throw new NotFoundError(
        `Signature with public key ${publicKey.substring(0, 8)} not found.`
      )
    }

    return rawSig
  }

  public async deleteSignatureByPublicKey(publicKey: string): Promise<void> {
    return await post({
      url: this.signature + '/delete/key' + publicKey,
      data: {
        data: {
          where: { publicKey },
          select: { sig: true, publicKey: true },
        },
      },
    }).then((res) => res.data)
  }
}

export default SignatureModel
