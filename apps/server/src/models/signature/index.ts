import { Prisma, PrismaClient } from '@prisma/client'
import { log } from '../../lib/log'

import { NotFoundError } from '../errors'

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
  signature: PrismaClient['signature']
  table: string

  constructor(env: string) {
    const prisma = new PrismaClient()
    this.table = `identity_table_${env}`
    this.signature = prisma.signature
  }

  public async createSignature(
    publicKey: string,
    sig: string
  ): Promise<Signature> {
    return await this.signature.upsert({
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
    })
  }

  public async getSignatureByPublicKey(publicKey: string): Promise<Signature> {
    const rawSig = await this.signature.findUnique({
      where: {
        publicKey,
      },
      select: { sig: true, publicKey: true },
    })

    if (!rawSig) {
      throw new NotFoundError(
        `Signature with public key ${publicKey.substring(0, 8)} not found.`
      )
    }

    return rawSig
  }

  public async deleteSignatureByPublicKey(publicKey: string): Promise<void> {
    try {
      await this.signature.delete({
        where: { publicKey },
        select: { sig: true, publicKey: true },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // The .code property can be accessed in a type-safe manner
        if (e.code === 'P2025') {
          log('Record to delete does not exist.')
        }
      }
    }
  }
}

export default SignatureModel
