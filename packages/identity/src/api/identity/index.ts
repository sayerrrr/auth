import { v4 as uuidv4 } from 'uuid'
import { get, post } from '../api'

import {
  CreateIdentityInput,
  CreateProofInput,
  GetIdentitiesQuery,
  GetIdentityQueryType,
  Identity,
  Proof,
} from './types'

export class IdentityModel {
  identity: string
  proof: string
  meta: string

  constructor() {
    this.identity = '/api/v1/identity'
    this.proof = '/api/v1/proof'
    this.meta = '/api/v1/metadata'
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

    if (!found) {
      return await post({
        url: this.identity + '/upsert',
        data: {
          data: {
            where: { uuid: uuid },
            create: { uuid, metadata: { create: { ...meta } } },
            update: { metadata: { update: { ...meta } } },
          },
        },
      })
    }

    return null
  }

  public async createProof(input: CreateProofInput): Promise<Proof> {
    return await post({
      url: this.proof + '/create',
      data: {
        data: {
          type: input.type,
          uuid: input.uuid,
          value: input.value,
        },
      },
    })
  }

  public async getIdentityByUuid(uuid: string): Promise<Identity[]> {
    return await get({
      url: this.identity + '/get/uuid/' + uuid,
    })
  }

  public async deleteIdentityByUuid(uuid: string): Promise<Identity> {
    return await post({
      url: this.identity + '/delete/' + uuid,
    })
  }

  public async getIdentitiesByAddress(
    address: string
  ): Promise<Identity[] | null[]> {
    return await get({
      url: this.identity + '/get/address/' + address,
    })
  }

  public async getIdentityByPublicKey(
    publicKey: string
  ): Promise<Identity | null> {
    return await get({
      url: this.identity + '/get/key/' + publicKey,
    })
  }

  public async getIdentityByEmail(email: string): Promise<Identity | null> {
    return await get({
      url: this.identity + '/get/email/' + email,
    })
  }

  public async getIdentities(query: GetIdentitiesQuery[]): Promise<Identity[]> {
    const ps: Promise<Identity | null>[] = []

    query.forEach((q) => {
      if (q.type === GetIdentityQueryType.email) {
        return ps.push(this.getIdentityByEmail(q.value))
      }

      throw new Error('Incompatible query type')
    })

    return (await Promise.all(ps)).filter((r) => r !== null) as Identity[]
  }
}

export default IdentityModel
