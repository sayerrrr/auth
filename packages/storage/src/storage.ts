import { Mailbox } from '@resource/mailbox'
import {
  authenticate,
  getAddressFromPublicKey,
  tryParsePublicKey,
} from '@resource/utils'
import { PrivateKey } from '@textile/crypto'
import {
  Buckets,
  Client,
  PathAccessRole,
  PathItem,
  Root,
  ThreadID,
  UserAuth,
  UserMessage,
} from '@textile/hub'
import dayjs from 'dayjs'
import ee from 'event-emitter'
import { flattenDeep } from 'lodash'
import Pino from 'pino'
import { TextDecoder, TextEncoder } from 'util'
import { v4 } from 'uuid'

import { DirEntryNotFoundError, UnauthenticatedError } from './errors'
import { Listener } from './listener'
import {
  BucketMetadata,
  FileMetadata,
  UserMetadataStore,
} from './metadata/metadata'
import { GundbMetadataStore } from './metadata/store'
import {
  AddItemsRequest,
  AddItemsResponse,
  AddItemsResultSummary,
  AddItemsStatus,
  CreateFolderRequest,
  DirectoryEntry,
  FileMember,
  FullPath,
  iKeyUser,
  Invitation,
  ListDirectoryRequest,
  ListDirectoryResponse,
  Notification,
  NotificationSubscribeResponse,
  NotificationType,
  TxlSubscribeResponse,
} from './types'
import {
  decodeFileEncryptionKey,
  filePathFromIpfsPath,
  generateFileEncryptionKey,
  getDeterministicThreadID,
  getParentPath,
  isMetaFileName,
  isTopLevelPath,
  newEncryptedDataWriter,
  reOrderPathByParents,
  sanitizePath,
} from './utils'

export interface UserStorageConfig {
  textileHubAddress: string
  bucketsInit?: (auth: UserAuth) => Buckets
  threadsInit?: (auth: UserAuth) => Client
  metadataStoreInit?: (identity: PrivateKey) => Promise<UserMetadataStore>
  debugMode?: boolean
}

interface DecryptedUserMessage extends UserMessage {
  decryptedBody: Uint8Array
}

const DefaultTextileHubAddress = 'https://webapi.hub.textile.io'

interface BucketMetadataWithThreads extends BucketMetadata {
  root?: Root
  threadId?: string
}

export class UserStorage {
  private userMetadataStore?: UserMetadataStore

  private listener?: Listener

  private mailbox?: Mailbox

  private logger: Pino.Logger

  constructor(
    private readonly user: iKeyUser,
    private readonly config: UserStorageConfig
  ) {
    this.config.textileHubAddress =
      config.textileHubAddress ?? DefaultTextileHubAddress
    this.logger = Pino({
      enabled: config.debugMode || false,
    }).child({ pk: user.identity.public.toString() })
  }

  public async initListener(): Promise<void> {
    const metadataStore = await this.getMetadataStore()
    const buckets = await metadataStore.listBuckets()
    const ids = buckets.map((bucket) => bucket.dbId)
    const threadsClient = this.getUserThreadsClient()
    this.listener = new Listener(ids, threadsClient)
  }

  public async initMailbox(): Promise<void> {
    this.mailbox = await this.initMailboxForUser(this.user)
  }

  private async initMailboxForUser(user: iKeyUser): Promise<any> {
    return Mailbox.createMailbox(
      user,
      {
        textileHubAddress: this.config.textileHubAddress,
      },
      UserStorage.parseMsg
    )
  }

  async syncFromTempKey(key: string): Promise<void> {
    const { tempiKeyUser, tempUserMailbox } = await this.authenticateTempUser(
      key
    )

    const msgs: DecryptedUserMessage[] | undefined =
      await tempUserMailbox.listInboxMessages()
    if (!msgs) {
      this.logger.info("TempKey's inbox is empty no syncing necessary")
      return
    }
    this.logger.info({ msgs }, "TempKey's existing inboxes")

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tempUserClient = this.initBucket(tempiKeyUser.storageAuth!)
    if (!this.mailbox) {
      await this.initMailbox()
    }

    await Promise.all(
      msgs.map(async (msg) => {
        await this.syncTempUsersMessageWithUser(
          msg,
          tempiKeyUser,
          tempUserClient,
          tempUserMailbox
        )
      })
    )
  }

  private async authenticateTempUser(key: string) {
    const tempKeyIdentity = PrivateKey.fromString(key)
    const tempUserAuth = await authenticate(this.user.endpoint, tempKeyIdentity)
    const tempiKeyUser = {
      ...tempUserAuth,
      endpoint: this.user.endpoint,
      identity: tempKeyIdentity,
    }
    const tempUserMailbox = await this.initMailboxForUser(tempiKeyUser)
    return { tempiKeyUser, tempUserMailbox }
  }

  private async syncTempUsersMessageWithUser(
    msg: DecryptedUserMessage,
    tempiKeyUser: iKeyUser,
    tempUserClient: Buckets,
    tempUserMailbox: Mailbox
  ) {
    const tempUsersPublicKey = tempiKeyUser.identity.public.toString()
    const currentUsersPublicKey = this.user.identity.public.toString()
    let bodyToBeForwarded = msg.body
    const notification = await UserStorage.parseMsg(msg)

    if (notification.type === NotificationType.INVITATION) {
      const invitation = notification.relatedObject as Invitation

      // swap access roles to new user
      await Promise.all(
        invitation.itemPaths.map(async (ivPaths) => {
          const roles = new Map<string, PathAccessRole>()
          roles.set(
            currentUsersPublicKey,
            PathAccessRole.PATH_ACCESS_ROLE_ADMIN
          )
          roles.set(
            tempUsersPublicKey,
            PathAccessRole.PATH_ACCESS_ROLE_UNSPECIFIED
          )

          tempUserClient.withThread(ivPaths.dbId)
          await tempUserClient.pushPathAccessRoles(
            ivPaths.bucketKey || '',
            ivPaths.path,
            roles
          )
        })
      )

      // re-map relevant parameters
      invitation.inviteePublicKey = currentUsersPublicKey
      bodyToBeForwarded = new TextEncoder().encode(
        JSON.stringify({
          type: notification.type,
          body: invitation,
        })
      )
    }

    // forwarding message to user
    await tempUserMailbox.sendMessage(currentUsersPublicKey, bodyToBeForwarded)
    await tempUserMailbox.deleteMessage(msg.id)
  }

  /**
   * Creates an empty folder at the requested path and bucket.
   *
   * @remarks
   * - It throws if an error occurred while creating the folder
   */
  public async createFolder(request: CreateFolderRequest): Promise<void> {
    const client = this.getUserBucketsClient()
    const metadataStore = await this.getMetadataStore()

    const bucket = await this.getOrCreateBucket(client, request.bucket)
    const file = {
      path: `${sanitizePath(request.path.trimStart())}/.keep`,
      content: Buffer.from(''),
    }

    await metadataStore.upsertFileMetadata({
      uuid: v4(),
      bucketKey: bucket.root?.key,
      bucketSlug: bucket.slug,
      dbId: bucket.dbId,
      encryptionKey: generateFileEncryptionKey(),
      path: file.path,
    })
    await client.pushPath(bucket.root?.key || '', '.keep', file)
  }

  private static async addMembersToPathItems(
    items: DirectoryEntry[],
    client: Buckets,
    store: UserMetadataStore,
    bucketKey?: string
  ): Promise<DirectoryEntry[]> {
    if (items.length === 0) {
      return []
    }

    const newItems = items
    let key = bucketKey

    if (!key) {
      const bucketData = await store.findBucket(items[0].bucket)
      if (!bucketData) {
        throw new Error('Unable to find bucket metadata')
      }
      key = bucketData?.bucketKey
    }

    for (let i = 0; i < newItems.length; i += 1) {
      const ms = await client.pullPathAccessRoles(key, newItems[i].path)

      if (ms) {
        const members: FileMember[] = []

        ms.forEach((v, k) => {
          members.push({
            publicKey:
              k === '*'
                ? '*'
                : Buffer.from(tryParsePublicKey(k).pubKey).toString('hex'),
            address: k === '*' ? '' : getAddressFromPublicKey(k),
            role: v,
          })
        })

        newItems[i].members = members

        if ((newItems[i]?.items?.length || 0) > 0) {
          newItems[i].items = await this.addMembersToPathItems(
            newItems[i].items as DirectoryEntry[],
            client,
            store,
            key
          )
        }
      }
    }

    return newItems
  }

  private static parsePathItems(
    its: PathItem[],
    metadataMap: Record<string, FileMetadata>,
    bucket: string,
    dbId: string
  ): DirectoryEntry[] {
    const filteredEntries = its.filter(
      (it: PathItem) => !isMetaFileName(it.name)
    )

    const des: DirectoryEntry[] = filteredEntries.map((it: PathItem) => {
      const path = filePathFromIpfsPath(it.path)

      if (!path) {
        throw new Error('Unable to regex parse the path')
      }

      if (!it.metadata || !it.metadata.updatedAt) {
        throw new Error('Unable to parse updatedAt from bucket file')
      }

      const { name, isDir, count } = it

      // need to divide because textile gives nanoseconds
      const dt = new Date(Math.round(it.metadata.updatedAt / 1000000))
      // using moment to get required output format 2021-01-12T22:57:34-05:00
      const d = dayjs(dt)

      return {
        name,
        isDir,
        count,
        path,
        ipfsHash: it.cid,
        sizeInBytes: it.size,
        // using the updated date as weare in the daemon, should
        // change once createdAt is available
        created: d.format(),
        updated: d.format(),
        fileExtension:
          it.name.indexOf('.') >= 0
            ? it.name.substr(it.name.lastIndexOf('.') + 1)
            : '',
        isLocallyAvailable: false,
        backupCount: 1,
        members: [],
        isBackupInProgress: false,
        isRestoreInProgress: false,
        uuid: metadataMap[path]?.uuid || '',
        items: UserStorage.parsePathItems(it.items, metadataMap, bucket, dbId),
        bucket,
        dbId,
      }
    })

    return des
  }

  public async listenerSubscribe(): Promise<TxlSubscribeResponse> {
    this.getUserBucketsClient()
    const emitter = ee()

    if (!this.listener) {
      throw new Error('Listener not initialized')
    }

    this.listener.subscribe(emitter)

    return emitter
  }

  public async notificationSubscribe(): Promise<NotificationSubscribeResponse> {
    const emitter = ee()

    if (!this.mailbox) {
      await this.initMailbox()
    }

    this.mailbox?.subscribe(emitter)

    return emitter
  }

  public async listDirectory(
    request: ListDirectoryRequest
  ): Promise<ListDirectoryResponse> {
    const client = this.getUserBucketsClient()
    const bucket = await this.getOrCreateBucket(client, request.bucket)
    const path = sanitizePath(request.path)
    const store = await this.getMetadataStore()

    const depth = request.recursive ? Number.MAX_SAFE_INTEGER : 0
    try {
      const result = await client.listPath(bucket.root?.key || '', path, depth)

      if (!result.item || !result.item.items) {
        return {
          items: [],
        }
      }

      const uuidMap = await this.getFileMetadataMap(
        bucket.slug,
        bucket.dbId,
        result.item?.items || []
      )

      const items =
        UserStorage.parsePathItems(
          result.item?.items || [],
          uuidMap,
          bucket.slug,
          bucket.dbId
        ) || []
      const itemsWithMembers = await UserStorage.addMembersToPathItems(
        items,
        client,
        store
      )
      return {
        items: itemsWithMembers,
      }
    } catch (e) {
      if ((e as any).message.includes('no link named')) {
        throw new DirEntryNotFoundError(path, request.bucket)
      } else {
        throw e
      }
    }
  }

  public async addItems(request: AddItemsRequest): Promise<AddItemsResponse> {
    const client = this.getUserBucketsClient()
    const bucket = await this.getOrCreateBucket(client, request.bucket)
    const emitter = ee()

    setImmediate(() => {
      this.uploadMultipleFiles(request, client, bucket, emitter).then(
        (summary) => {
          emitter.emit('done', summary)
        }
      )
    })

    return emitter
  }

  private async uploadMultipleFiles(
    request: AddItemsRequest,
    client: Buckets,
    bucket: BucketMetadataWithThreads,
    emitter: ee.Emitter
  ): Promise<AddItemsResultSummary> {
    const metadataStore = await this.getMetadataStore()
    const rootKey = bucket.root?.key || ''
    const summary: AddItemsResultSummary = {
      bucket: request.bucket,
      files: [],
    }

    const reOrderedFiles = reOrderPathByParents(request.files, (it) => it.path)

    await reOrderedFiles.traverseLevels(async (dirFiles) => {
      // NOTE it is safe to use dirFiles[0].path because:
      // - dirFiles is guaranteed to be non-empty by traverseLevels
      // - all files in dirFiles would be in the same directory
      if (!isTopLevelPath(dirFiles[0].path)) {
        const parentPath = getParentPath(dirFiles[0].path)
        const status: AddItemsStatus = {
          path: parentPath,
          status: 'success',
        }
        this.logger.info({ path: parentPath }, 'Uploading parent directory')

        try {
          await this.createFolder({
            bucket: request.bucket,
            path: parentPath,
          })

          // set folder entry
          const newFolder = await client.listPath(rootKey, parentPath)
          const [folderEntry] = UserStorage.parsePathItems(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            [newFolder.item!],
            {},
            bucket.slug,
            bucket.dbId
          )
          const [folderEntryWithmembers] =
            await UserStorage.addMembersToPathItems(
              [folderEntry],
              client,
              metadataStore
            )
          status.entry = folderEntryWithmembers

          emitter.emit('data', status)
          summary.files.push(status)
        } catch (err) {
          status.status = 'error'
          status.error = err as Error
          emitter.emit('error', status)
          summary.files.push(status)

          // TODO: since root folder creation failed
          // should automatically fail all subsequent uploads
          // looking forward to community fixing this
        }
      }

      // sequentially upload each file in-order to avoid root corruption
      // that may occur when uploading multiple files in parallel.
      // eslint-disable-next-line no-restricted-syntax
      for (const file of dirFiles) {
        const path = sanitizePath(file.path)
        const status: AddItemsStatus = {
          path,
          status: 'success',
        }
        this.logger.info({ path }, 'Uploading file')

        try {
          const metadata = await metadataStore.upsertFileMetadata({
            uuid: v4(),
            mimeType: file.mimeType,
            bucketKey: bucket.root?.key,
            bucketSlug: bucket.slug,
            dbId: bucket.dbId,
            encryptionKey: generateFileEncryptionKey(),
            path,
          })

          const encryptedDataReader = newEncryptedDataWriter(
            file.data,
            decodeFileEncryptionKey(metadata.encryptionKey)
          )
          await client.pushPath(rootKey, path, encryptedDataReader, {
            progress: file.progress,
          })
          // set file entry
          const existingFile = await client.listPath(rootKey, path)
          const [fileEntry] = UserStorage.parsePathItems(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            [existingFile.item!],
            {
              [path]: metadata,
            },
            bucket.slug,
            bucket.dbId
          )

          const [fileEntryWithmembers] =
            await UserStorage.addMembersToPathItems(
              [fileEntry],
              client,
              metadataStore
            )

          status.entry = fileEntryWithmembers

          emitter.emit('data', status)
        } catch (err) {
          status.status = 'error'
          status.error = err as Error
          emitter.emit('error', status)
        }

        summary.files.push(status)
      }
    })

    return summary
  }

  private static async parseMsg(
    msg: DecryptedUserMessage
  ): Promise<Notification> {
    const body = JSON.parse(
      new TextDecoder().decode(Buffer.from(msg.decryptedBody))
    )

    const notif: Notification = {
      ...msg,
      decryptedBody: msg.decryptedBody,
      type: body.type as NotificationType,
    }

    switch (body.type) {
      case NotificationType.INVITATION:
        notif.relatedObject = body.body as Invitation
    }

    return notif
  }

  private async getFileMetadataMap(
    bucketSlug: string,
    dbId: string,
    items: PathItem[]
  ): Promise<Record<string, FileMetadata>> {
    const metadataStore = await this.getMetadataStore()
    const result: Record<string, FileMetadata> = {}

    const extractPathRecursive = (item: PathItem): string[] => [
      filePathFromIpfsPath(item.path),
      ...flattenDeep(item.items.map(extractPathRecursive)),
    ]
    const paths = flattenDeep(items.map(extractPathRecursive))

    this.logger.info('Building FileMetadata Map')
    await Promise.all(
      paths.map(async (path: string) => {
        const metadata = await metadataStore.findFileMetadata(
          bucketSlug,
          dbId,
          path
        )
        if (metadata) {
          result[path] = metadata
        }
      })
    )
    this.logger.info({ paths, map: result }, 'FileMetadata Map complete')

    return result
  }

  private async getOrCreateBucket(
    client: Buckets,
    name: string
  ): Promise<BucketMetadataWithThreads> {
    const metadataStore = await this.getMetadataStore()
    let metadata = await metadataStore.findBucket(name)
    let dbId
    if (!metadata) {
      dbId = ThreadID.fromRandom(ThreadID.Variant.Raw, 32).toString()
    } else {
      dbId = metadata.dbId
    }

    const getOrCreateResponse = await client.getOrCreate(name, {
      threadID: dbId,
    })

    if (!getOrCreateResponse.root) {
      throw new Error('Did not receive bucket root')
    }

    if (!metadata) {
      metadata = await metadataStore.createBucket(
        name,
        dbId,
        getOrCreateResponse.root.key
      )
    }

    // note: if initListener is not call, this won't
    // be registered
    this.listener?.addListener(metadata.dbId)

    return { ...metadata, ...getOrCreateResponse }
  }

  private async normalizeFullPaths(
    client: Buckets,
    fullPaths: FullPath[]
  ): Promise<{ key: string; fullPath: FullPath }[]> {
    this.logger.info({ fullPaths }, 'Normalizing full path')
    const store = await this.getMetadataStore()
    return Promise.all(
      fullPaths.map(async (fullPath) => {
        let rootKey: string
        let { dbId } = fullPath
        if (dbId) {
          const metadata = await store.findFileMetadata(
            fullPath.bucket,
            dbId,
            fullPath.path
          )
          if (!metadata) {
            throw new Error('Full Paths Bucket root not found')
          }

          rootKey = metadata.bucketKey || ''
        } else {
          const bucket = await this.getOrCreateBucket(client, fullPath.bucket)
          if (!bucket.root) {
            throw new Error('Bucket root not found')
          }

          rootKey = bucket.root.key
          dbId = bucket.dbId
        }

        return {
          key: rootKey || '',
          fullPath: {
            ...fullPath,
            dbId,
            path: sanitizePath(fullPath.path),
          },
        }
      })
    )
  }

  private getUserBucketsClient(): Buckets {
    return this.initBucket(this.getUserAuth())
  }

  private getUserThreadsClient(): Client {
    return this.initThreads(this.getUserAuth())
  }

  private getUserAuth(): UserAuth {
    if (this.user.storageAuth === undefined) {
      throw new UnauthenticatedError()
    }

    return this.user.storageAuth
  }

  private initBucket(userAuth: UserAuth): Buckets {
    if (this.config?.bucketsInit) {
      return this.config.bucketsInit(userAuth)
    }

    return Buckets.withUserAuth(userAuth, {
      host: this.config?.textileHubAddress,
    })
  }

  private initThreads(userAuth: UserAuth): Client {
    if (this.config?.threadsInit) {
      return this.config.threadsInit(userAuth)
    }

    return Client.withUserAuth(userAuth, this.config?.textileHubAddress)
  }

  private async getMetadataStore(): Promise<UserMetadataStore> {
    if (this.userMetadataStore) {
      return this.userMetadataStore
    }
    if (this.config.metadataStoreInit) {
      this.userMetadataStore = await this.config.metadataStoreInit(
        this.user.identity
      )
    } else {
      this.userMetadataStore = await this.getDefaultUserMetadataStore()
    }

    return this.userMetadataStore
  }

  private getDefaultUserMetadataStore(): Promise<UserMetadataStore> {
    const username = Buffer.from(this.user.identity.public.pubKey).toString(
      'hex'
    )
    const password = getDeterministicThreadID(this.user.identity).toString()
    return GundbMetadataStore.fromIdentity(
      username,
      password,
      undefined,
      this.logger
    )
  }
}
