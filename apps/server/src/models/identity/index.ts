import { Identity, PrismaClient, Proof } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

import {
  CreateIdentityInput,
  CreateProofInput,
  GetIdentitiesQuery,
  GetIdentityQueryType,
} from './types'

export class IdentityModel {
  identity: PrismaClient['identity']
  proof: PrismaClient['proof']
  meta: PrismaClient['metadata']
  table: string

  constructor(env: string) {
    const prisma = new PrismaClient()
    this.table = `identity_table_${env}`
    this.identity = prisma.identity
    this.proof = prisma.proof
    this.meta = prisma.metadata
  }

  public async insert(input: CreateIdentityInput): Promise<Identity | null> {
    const uuid = uuidv4()
    const meta = {
      address: input.address || '',
      username: input.username || '',
      publicKey: input.publicKey || '',
      email: input.email || '',
      provider: input.provider || '',
      name: input.name || '',
    }

    const found =
      (await this.getIdentitiesByAddress(meta.address)).length > 0 || false

    // create identity
    if (!found) {
      return await this.identity.upsert({
        where: { uuid: uuid },
        create: { uuid, metadata: { create: { ...meta } } },
        update: { metadata: { update: { ...meta } } },
      })
    }

    return null
  }

  public async createProof(input: CreateProofInput): Promise<Proof> {
    return await this.proof.create({
      data: {
        type: input.type,
        uuid: input.uuid,
        value: input.value,
      },
    })
  }

  public async getIdentityByUuid(uuid: string): Promise<Identity[]> {
    return await this.identity.findMany({ where: { uuid } })
  }

  public async deleteIdentityByUuid(uuid: string): Promise<Identity> {
    return await this.identity.delete({ where: { uuid } })
  }

  public async getIdentitiesByAddress(
    address: string
  ): Promise<Identity[] | null[]> {
    return (
      (
        await this.meta.findMany({
          where: { address },
          select: {
            identity: true,
          },
        })
      ).map((i) => i.identity) ?? []
    )
  }

  public async getIdentityByPublicKey(
    publicKey: string
  ): Promise<Identity | null> {
    return (
      (
        await this.meta.findUnique({
          where: { publicKey },
          select: {
            identity: true,
          },
        })
      )?.identity ?? null
    )
  }

  public async getIdentityByEmail(email: string): Promise<Identity | null> {
    return (
      (
        await this.meta.findUnique({
          where: { email },
          select: {
            identity: true,
          },
        })
      )?.identity ?? null
    )
  }

  public async getIdentities(query: GetIdentitiesQuery[]): Promise<Identity[]> {
    const ps: Promise<Identity | null>[] = []

    query.forEach((q) => {
      if (q.type === GetIdentityQueryType.email) {
        ps.push(this.getIdentityByEmail(q.value))
        return
      }

      throw new Error('Incompatible query type')
    })

    return (await Promise.all(ps)).filter((r) => r !== null) as Identity[]
  }
}

export default IdentityModel
