import Gun from 'gun'
import Pino from 'pino'
import {
  BucketMetadata,
  FileMetadata,
  SharedFileMetadata,
  ShareUserMetadata,
  UserMetadataStore,
} from './metadata'

const BucketMetadataCollection = 'BucketMetadata'
const SharedFileMetadataCollection = 'SharedFileMetadata'
const SharedByMeFileMetadataCollection = 'SharedByMeFileMetadata'
const RecentlySharedWithMetadataCollection = 'RecentlySharedWithMetadata'
const PublicStoreUsername = '66f47ce32570335085b39bdf'
const PublicStorePassword =
  '830a20694358651ef14e472fd71c4f9f843ecd50784b241a6c9999dba4c6fced0f90c686bdee28edc'

interface AckError {
  err: string
}

// Remapped bucket metadata type compatible with Gundb
type GunBucketMetadata = Omit<BucketMetadata, 'encryptionKey'> & {
  encryptionKey: string
}
type GunFileMetadata = { data: string }
type EncryptedMetadata = { data: string }

interface IGunInstance {
  [key: string]: any
}

interface LookupDataState {
  [dbIdBucket: string]: EncryptedMetadata
}

interface LookupFileMetadataState {
  [lookupId: string]: GunFileMetadata
}

interface ListDataState {
  [collectionName: string]: EncryptedMetadata[]
}

export type GunDataState =
  | LookupDataState
  | ListDataState
  | LookupFileMetadataState

type GunInit = () => IGunInstance

export class GundbMetadataStore implements UserMetadataStore {
  private gunInit: GunInit

  // in memory cache list of buckets
  private readonly bucketsListCache: BucketMetadata[]

  private readonly sharedFilesListCache: SharedFileMetadata[]

  private readonly sharedByMeFilesListCache: SharedFileMetadata[]

  private readonly recentlySharedWithListCache: ShareUserMetadata[]

  private _user?: any

  private _publicUser?: any

  private logger?: Pino.Logger

  /**
   * Creates a new instance of this metadata store for users identity.
   *
   */
  private constructor(
    private readonly username: string,
    private readonly userpass: string,
    gunOrServer?: GunInit | string | string[],
    logger?: Pino.Logger | boolean
  ) {
    if (gunOrServer) {
      if (typeof gunOrServer === 'string' || Array.isArray(gunOrServer)) {
        this.gunInit = () => new Gun(gunOrServer)
      } else {
        this.gunInit = gunOrServer
      }
    } else {
      this.gunInit = () =>
        new Gun({
          localStorage: false,
          radisk: true,
          peers: 'http://localhost/gun',
        } as any)
    }

    this.bucketsListCache = []
    this.sharedFilesListCache = []
    this.sharedByMeFilesListCache = []
    this.recentlySharedWithListCache = []

    if (logger) {
      if (typeof logger === 'boolean') {
        this.logger = Pino({ enabled: logger || false, level: 'trace' })
      } else {
        this.logger = logger
      }

      this.logger = this.logger.child({ storeUser: username })
    }
  }

  /**
   * Creates a new instance of this metadata store for users identity.
   *
   * @param username - Username of user
   * @param userpass - Password of user
   * @param gunOrServer - initialized gun instance or peer server
   * @param logger - Optional pino logger instance for debug mode
   */
  static async fromIdentity(
    username: string,
    userpass: string,
    gunOrServer?: GunInit | string | string[],
    logger?: Pino.Logger | boolean
  ): Promise<GundbMetadataStore> {
    const store = new GundbMetadataStore(
      username,
      userpass,
      gunOrServer,
      logger
    )

    store._user = store.gunInit().user()
    await store.authenticateUser(store._user, username, userpass)
    store._publicUser = store.gunInit().user()
    await store.authenticateUser(
      store._publicUser,
      PublicStoreUsername,
      PublicStorePassword
    )

    await store.startCachingBucketsList()
    await store.startCachingList(
      SharedFileMetadataCollection,
      store.sharedFilesListCache
    )
    await store.startCachingList(
      SharedByMeFileMetadataCollection,
      store.sharedByMeFilesListCache
    )
    await store.startCachingList(
      RecentlySharedWithMetadataCollection,
      store.recentlySharedWithListCache
    )

    return store
  }

  public async createBucket(
    bucketSlug: string,
    dbId: string,
    bucketKey: string
  ): Promise<BucketMetadata> {
    // throw if dbId with bucketSlug doesn't already
    const existingBucket = await this.findBucket(bucketSlug)
    if (existingBucket) {
      throw new Error('Bucket with slug and dbId already exists')
    }

    const schema: BucketMetadata = {
      dbId,
      slug: bucketSlug,
      bucketKey,
    }
    const encryptedMetadata = await this.encryptBucketSchema(schema)
    const lookupKey = this.getBucketsLookupKey(bucketSlug)

    const nodeRef = this.lookupUser.get(lookupKey).put(encryptedMetadata)
    // store in list too. the unknown cast is required because of typescripts limitation
    // but it to ensure that the set has a reference to the actual data
    this.listUser
      .get(BucketMetadataCollection)
      .set(nodeRef as unknown as EncryptedMetadata)

    return schema
  }

  public async getNotificationsLastSeenAt(): Promise<number> {
    this.logger?.info(
      { username: this.username },
      'Store.getNotificationsLastSeenAt'
    )
    const lookupKey = GundbMetadataStore.getNotificationsLastSeenAtLookupKey()
    const res: number | undefined = await this.lookupUserData(lookupKey)
    return res || 0
  }

  public async findBucket(
    bucketSlug: string
  ): Promise<BucketMetadata | undefined> {
    this.logger?.info({ bucketSlug }, 'Store.findBucket')
    const lookupKey = this.getBucketsLookupKey(bucketSlug)
    const encryptedData = await new Promise<string | undefined>((resolve) => {
      this.lookupUser
        .get(lookupKey)
        .get('data')
        .once((data: unknown) => {
          if (!data) {
            this.logger?.info({ bucketSlug }, 'Bucket Metadata not found')
            return resolve(undefined)
          }

          this.logger?.info({ bucketSlug }, 'Bucket Metadata found')
          return resolve(data as string)
        })
    })

    this.lookupUser.get(lookupKey).off()

    if (!encryptedData) {
      return undefined
    }

    return this.decryptBucketSchema({ data: encryptedData })
  }

  public async listBuckets(): Promise<BucketMetadata[]> {
    return this.bucketsListCache
  }

  public async upsertFileMetadata(
    metadata: FileMetadata
  ): Promise<FileMetadata> {
    const { bucketSlug, dbId, path } = metadata
    const lookupKey = GundbMetadataStore.getFilesLookupKey(
      bucketSlug,
      dbId,
      path
    )
    const existingFileMetadata = await this.findFileMetadata(
      bucketSlug,
      dbId,
      path
    )

    let updatedMetadata = metadata
    if (existingFileMetadata) {
      updatedMetadata = {
        ...existingFileMetadata,
        ...metadata,
      }
    }

    this.logger?.info({ updatedMetadata }, 'Upserting metadata')

    const encryptedMetadata = await this.encrypt(
      JSON.stringify(updatedMetadata)
    )
    this.lookupUser.get(lookupKey).put({ data: encryptedMetadata })

    if (updatedMetadata.uuid) {
      this.lookupUser
        .get(GundbMetadataStore.getFilesUuidLookupKey(updatedMetadata.uuid))
        .put({ data: encryptedMetadata })
    }

    return updatedMetadata
  }

  public async findFileMetadata(
    bucketSlug: string,
    dbId: string,
    path: string
  ): Promise<FileMetadata | undefined> {
    this.logger?.info({ bucketSlug, dbId, path }, 'Store.findFileMetadata')
    const lookupKey = GundbMetadataStore.getFilesLookupKey(
      bucketSlug,
      dbId,
      path
    )
    return this.lookupUserData(lookupKey)
  }

  public async findFileMetadataByUuid(
    uuid: string
  ): Promise<FileMetadata | undefined> {
    this.logger?.info({ uuid }, 'Store.findFileMetadataByUuid')
    const lookupKey = GundbMetadataStore.getFilesUuidLookupKey(uuid)

    // NOTE: This can be speedup by making this fetch promise a race instead of sequential
    return this.lookupUserData<FileMetadata>(lookupKey).then((data) => {
      if (!data) {
        return this.lookupPublicFileMetadata(lookupKey)
      }
      return data
    })
  }

  public async setFilePublic(metadata: FileMetadata): Promise<void> {
    if (metadata.uuid === undefined) {
      throw new Error('metadata file must have a uuid')
    }

    const lookupKey = GundbMetadataStore.getFilesUuidLookupKey(metadata.uuid)
    this.logger?.info({ metadata, lookupKey }, 'Making file metadata public')

    this.publicLookupChain
      .get(lookupKey)
      .put({ data: JSON.stringify(metadata) })
  }

  public async upsertSharedWithMeFile(
    fileData: SharedFileMetadata
  ): Promise<SharedFileMetadata> {
    const { bucketSlug, dbId, path } = fileData
    const lookupKey = GundbMetadataStore.getFilesLookupKey(
      bucketSlug,
      dbId,
      path
    )
    const existingFileMetadata = await this.lookupUserData<SharedFileMetadata>(
      lookupKey
    )

    let updatedMetadata = fileData
    if (existingFileMetadata) {
      updatedMetadata = {
        ...existingFileMetadata,
        ...fileData,
      }
    }
    this.logger?.info({ updatedMetadata }, 'Upserting upsertSharedWithMeFile')
    const encryptedMetadata = await this.encrypt(
      JSON.stringify(updatedMetadata)
    )
    const nodeRef = this.lookupUser
      .get(lookupKey)
      .put({ data: encryptedMetadata })

    // track via invitationId
    if (updatedMetadata.invitationId) {
      this.lookupUser
        .get(
          GundbMetadataStore.getFilesInvitationLookupKey(
            updatedMetadata.invitationId
          )
        )
        .put({ data: encryptedMetadata })
    }

    if (updatedMetadata.uuid) {
      this.lookupUser
        .get(GundbMetadataStore.getFilesUuidLookupKey(updatedMetadata.uuid))
        .put({ data: encryptedMetadata })
    }

    this.listUser
      .get(SharedFileMetadataCollection)
      .set(nodeRef as unknown as EncryptedMetadata)

    return updatedMetadata
  }

  async findSharedFilesByInvitation(
    invitationId: string
  ): Promise<SharedFileMetadata | undefined> {
    this.logger?.info({ invitationId }, 'Store.findSharedFilesByInvitation')
    const lookupKey =
      GundbMetadataStore.getFilesInvitationLookupKey(invitationId)
    return this.lookupUserData(lookupKey)
  }

  public async listSharedWithMeFiles(): Promise<SharedFileMetadata[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.sharedFilesListCache)
      }, 1000)
    })
  }

  public async upsertSharedByMeFile(
    fileData: SharedFileMetadata
  ): Promise<SharedFileMetadata> {
    const { bucketSlug, dbId, path } = fileData
    const lookupKey = GundbMetadataStore.getSharedByMeLookupKey(
      bucketSlug,
      dbId,
      path
    )
    const existingFileMetadata = await this.lookupUserData<SharedFileMetadata>(
      lookupKey
    )

    let updatedMetadata = fileData
    if (existingFileMetadata) {
      updatedMetadata = {
        ...existingFileMetadata,
        ...fileData,
      }
    }
    this.logger?.info({ updatedMetadata }, 'Upserting upsertSharedByMeFile')
    const encryptedMetadata = await this.encrypt(
      JSON.stringify(updatedMetadata)
    )
    const nodeRef = this.lookupUser
      .get(lookupKey)
      .put({ data: encryptedMetadata })
    this.listUser
      .get(SharedByMeFileMetadataCollection)
      .set(nodeRef as unknown as EncryptedMetadata)
    return updatedMetadata
  }

  public async listSharedByMeFiles(): Promise<SharedFileMetadata[]> {
    return new Promise((resolve) => {
      setImmediate(() => {
        resolve(this.sharedByMeFilesListCache)
      })
    })
  }

  public async addUserRecentlySharedWith(
    user: ShareUserMetadata
  ): Promise<ShareUserMetadata> {
    const lookupKey = GundbMetadataStore.getRecentSharedLookupKey(
      user.publicKey
    )
    const existingUser = await this.lookupUserData<ShareUserMetadata>(lookupKey)

    let updatedUser = user

    if (existingUser) {
      updatedUser = {
        ...existingUser,
        ...user,
      }
    }

    this.logger?.info({ updatedUser }, 'Upserting addUserRecentlySharedWith')

    const encryptedMetadata = await this.encrypt(JSON.stringify(updatedUser))
    const nodeRef = this.lookupUser
      .get(lookupKey)
      .put({ data: encryptedMetadata })
    this.listUser
      .get(RecentlySharedWithMetadataCollection)
      .set(nodeRef as unknown as EncryptedMetadata)

    return updatedUser
  }

  public async listUsersRecentlySharedWith(): Promise<ShareUserMetadata[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.recentlySharedWithListCache)
      }, 1000)
    })
  }

  private async lookupUserData<T>(lookupKey: string): Promise<T | undefined> {
    return new Promise<T | undefined>((resolve, reject) => {
      this.lookupUser
        .get(lookupKey)
        .get('data')
        .once(async (encryptedData: any) => {
          if (!encryptedData) {
            this.logger?.info({ lookupKey }, 'FileMetadata not found')
            resolve(undefined)
            return
          }

          try {
            const decryptedMetadata = await this.decrypt<T>(encryptedData)
            this.logger?.debug(
              { decryptedMetadata, lookupKey },
              'FileMetadata found'
            )
            resolve(decryptedMetadata)
          } catch (e) {
            reject(e)
          }
        })
    })
  }

  private async lookupPublicFileMetadata(
    lookupKey: string
  ): Promise<FileMetadata | undefined> {
    return new Promise<FileMetadata | undefined>((resolve, reject) => {
      this.publicLookupChain
        .get(lookupKey)
        .get('data')
        .once((data: unknown) => {
          if (!data) {
            this.logger?.info({ lookupKey }, 'Public FileMetadata not found')
            resolve(undefined)
            return
          }

          this.logger?.info({ lookupKey }, 'Public FileMetadata found')
          resolve(JSON.parse(data as string))
        })
    })
  }

  private async startCachingBucketsList(): Promise<void> {
    this.listUser
      .get(BucketMetadataCollection)
      .map()
      .once(async (data: unknown) => {
        if (data) {
          try {
            const decryptedData = await this.decryptBucketSchema(
              data as EncryptedMetadata
            )

            this.bucketsListCache.push(decryptedData)
          } catch (e) {}
        }
      })

    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  private async startCachingList<T>(
    collection: string,
    cache: T[]
  ): Promise<void> {
    this.listUser
      .get(collection)
      .map()
      .once(async (data: { data: string }) => {
        if (data) {
          try {
            const decryptedData = await this.decrypt<T>(data.data)
            if (decryptedData) {
              cache.push(decryptedData)
            }
          } catch (e) {}
        }
      })
  }

  private static getNotificationsLastSeenAtLookupKey(): string {
    return 'notifications/lastSeenAt'
  }

  private getBucketsLookupKey(bucketSlug: string): string {
    return `bucketSchema/${bucketSlug}/${this.username}`
  }

  private static getFilesLookupKey(
    bucketSlug: string,
    dbId: string,
    path: string
  ): string {
    return `fileMetadata/${bucketSlug}/${dbId}/${path}`
  }

  private static getFilesInvitationLookupKey(invitationId: string): string {
    return `sharedFileIv/${invitationId}`
  }

  private static getSharedByMeLookupKey(
    bucketSlug: string,
    dbId: string,
    path: string
  ): string {
    return `sharedByMe/${bucketSlug}/${dbId}/${path}`
  }

  private static getRecentSharedLookupKey(publicKey: string): string {
    return `recentlySharedWith/${publicKey}`
  }

  private static getFilesUuidLookupKey(uuid: string): string {
    return `/fuuid/${uuid}`
  }

  private get user() {
    if (
      !this._user ||
      !(this._user as unknown as { is?: Record<never, never> }).is
    ) {
      throw new Error('gundb user not authenticated')
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._user!
  }

  private get publicUser() {
    if (
      !this._publicUser ||
      !(this._publicUser as unknown as { is?: Record<never, never> }).is
    ) {
      throw new Error('gundb user not authenticated')
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._publicUser!
  }

  // use this alias getter for lookuping up users metadata so typescript works as expected
  private get lookupUser() {
    return this.user
  }

  // use this alias getter for listening to users metadata list so typescript works as expected
  private get listUser(): any {
    return this.user
  }

  private get publicLookupChain(): any {
    return this.publicUser as any
  }

  private async authenticateUser(
    user: any,
    username: string,
    userpass: string
  ): Promise<void> {
    this.logger?.info({ username }, 'Authenticating user')
    // user.is checks if user is currently logged in
    if ((user as unknown as { is?: Record<never, never> }).is) {
      this.logger?.info({ username }, 'User already authenticated')
      return
    }

    await new Promise((resolve, reject) => {
      user.create(username, userpass, () => {
        user.auth(username, userpass, (auth: AckError) => {
          if ((auth as AckError).err) {
            reject(
              new Error(
                `gundb failed to authenticate user: ${(auth as AckError).err}`
              )
            )
            return
          }
          resolve(null)
        })
      })
    })
  }

  // encrypts data with users private key
  private async encrypt(data: string): Promise<string> {
    return Gun.SEA.encrypt(data, this.userpass)
  }

  private async decrypt<T>(data: string): Promise<T | undefined> {
    return Gun.SEA.decrypt(data, this.userpass) as Promise<T | undefined>
  }

  private async encryptBucketSchema(
    schema: BucketMetadata
  ): Promise<EncryptedMetadata> {
    return {
      data: await this.encrypt(JSON.stringify(schema)),
    }
  }

  private async decryptBucketSchema(
    encryptedSchema: EncryptedMetadata
  ): Promise<BucketMetadata> {
    const gunschema = await this.decrypt<GunBucketMetadata>(
      encryptedSchema.data
    )
    if (!gunschema) {
      throw new Error('Unknown bucket metadata')
    }

    return gunschema
  }
}
