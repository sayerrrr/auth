import {
  authenticate,
  HubAuthResponse,
  TextileStorageAuth,
} from '@resource/utils'
import {
  getPrivateKeyFromVaultItem,
  getVaultItemFromPrivateKey,
  Vault,
  VaultBackupType,
  VaultService,
  VaultServiceConfig,
} from './vault'
import { PrivateKey } from '@textile/crypto'
import omit from 'lodash/omit'
import values from 'lodash/values'

export interface IUser {
  identity: PrivateKey
  endpoint: string
  token: string
  storageAuth?: TextileStorageAuth
}

export interface IdentityStorage {
  list: () => Promise<PrivateKey[]>
  add: (identity: PrivateKey) => Promise<void>
  remove: (key: string) => Promise<void>
}

const privateKeyBytes = 32

export interface IdentitiesConfig {
  endpoint: string
  vaultServiceConfig?: VaultServiceConfig
  vaultInit?: () => Vault
  authChallengeSolver?: (identity: PrivateKey) => Promise<HubAuthResponse>
}

export class Identities {
  private config: IdentitiesConfig

  private storage?: IdentityStorage

  private identities: Record<string, IUser>

  private vaultObj?: Vault

  constructor(config: IdentitiesConfig, storage?: IdentityStorage) {
    this.config = config
    this.storage = storage
    this.identities = {}
  }

  static async withStorage(
    storage: IdentityStorage,
    config: IdentitiesConfig,
    onError?: CallableFunction
  ): Promise<Identities> {
    const accounts = await storage.list()
    const identities = new Identities(config, storage)

    await Promise.all(
      accounts.map(async (id: PrivateKey) => {
        await identities
          .authenticate(id)
          .catch((e) => onError && onError(e, id))
      })
    )

    return identities
  }

  async createIdentity(): Promise<PrivateKey> {
    const id = PrivateKey.fromRandom()
    if (this.storage) {
      await this.storage.add(id)
    }
    return id
  }

  list(): IUser[] {
    return values(this.identities)
  }

  async remove(publicKey: string): Promise<void> {
    if (this.storage) {
      await this.storage.remove(publicKey)
    }

    this.identities = omit(this.identities, [publicKey])
  }

  async authenticate(identity: PrivateKey): Promise<IUser> {
    let storageAuth: HubAuthResponse

    if (this.config.authChallengeSolver) {
      storageAuth = await this.config.authChallengeSolver(identity)
    } else {
      storageAuth = await authenticate(this.config.endpoint, identity)
    }

    const context = {
      ...storageAuth,
      identity,
      endpoint: this.config.endpoint,
    }

    this.identities[identity.public.toString()] = context

    return context
  }

  public async recoverKeysByPassphrase(
    uuid: string,
    passphrase: string,
    backupType: VaultBackupType
  ): Promise<IUser> {
    const vaultItems = await this.vault.retrieve(uuid, passphrase, backupType)
    const privKey = getPrivateKeyFromVaultItem(vaultItems[0])
    const identity = new PrivateKey(privKey.slice(0, privateKeyBytes))
    const iUser = await this.authenticate(identity)
    await this.storage?.add(identity)
    return iUser
  }

  public async backupKeysByPassphrase(
    uuid: string,
    passphrase: string,
    backupType: VaultBackupType,
    identity: PrivateKey
  ): Promise<void> {
    const iUser = await this.authenticate(identity)

    const pk = await this.getPrivKeyFromIdentity(identity)
    await this.vault.store(
      uuid,
      passphrase,
      backupType,
      [getVaultItemFromPrivateKey(Buffer.from(pk))],
      {
        sessionToken: iUser.token,
      }
    )
  }

  private get vault(): Vault {
    if (this.vaultObj) {
      return this.vaultObj
    }

    if (this.config.vaultInit) {
      this.vaultObj = this.config.vaultInit()
    } else if (this.config.vaultServiceConfig) {
      this.vaultObj = new VaultService(this.config.vaultServiceConfig)
    } else {
      throw new Error(
        'Either vaultServiceConfig or vaultInit configuration is required.'
      )
    }

    return this.vaultObj
  }

  private async getPrivKeyFromIdentity(
    identity: PrivateKey
  ): Promise<Uint8Array> {
    if (identity.privKey) {
      return identity.privKey
    }

    // check cache
    if (this.identities[identity.public.toString()]) {
      const idx = this.identities[identity.public.toString()]
      if (idx && idx.identity && idx.identity.privKey) {
        return idx.identity.privKey
      }
    }

    // check identity storage
    if (this.storage) {
      const identities = await this.storage.list()
      const foundPk = identities.find(
        (value) => value.public.toString() === identity.public.toString()
      )

      if (foundPk && foundPk.privKey) {
        return foundPk.privKey
      }
    }

    throw new Error('identity provided is not a valid PrivateKey Identity.')
  }
}
