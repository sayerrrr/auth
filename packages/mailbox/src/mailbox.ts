import { grpc } from '@improbable-eng/grpc-web'
import type { IUser } from '@resource/identity'
import { Notification } from '@resource/storage'
import { tryParsePublicKey } from '@resource/utils'
import {
  Identity,
  MailboxEvent,
  PrivateKey,
  UserAuth,
  UserMessage,
  Users
} from '@textile/hub'
import * as ee from 'event-emitter'


export interface MailboxConfig {
  textileHubAddress: string
  usersInit?: (auth: UserAuth) => Users
}

export interface DecryptedUserMessage extends UserMessage {
  decryptedBody: Uint8Array
}

export class Mailbox {
  private listener?: grpc.Request

  private emitters: ee.Emitter[]

  private constructor(
    private readonly user: IUser,
    private readonly config: MailboxConfig
  ) {
    this.emitters = []
  }

  public static async createMailbox(
    user: IUser,
    config: MailboxConfig,
    parser: (dec: DecryptedUserMessage) => Promise<Notification>
  ): Promise<Mailbox> {
    const mb = new Mailbox(user, config)
    const mid = await mb.getUsersClient().setupMailbox()

    const callback = (reply?: MailboxEvent) => {
      if (!reply || !reply.message) return

      mb.emitters.forEach(async (emitter) => {
        if (reply.message) {
          const dec = await mb.messageDecoder(mb.user, reply.message)
          const parsed = await parser(dec)
          emitter.emit('data', { notification: parsed })
        }
      })
    }

    mb.listener = await mb.getUsersClient().watchInbox(mid, callback)
    return mb
  }

  public subscribe(emitter: ee.Emitter): void {
    this.emitters.push(emitter)
  }

  public async listInboxMessages(
    seek?: string,
    limit?: number
  ): Promise<DecryptedUserMessage[]> {
    const res = await this.getUsersClient().listInboxMessages({
      seek,
      limit,
    })

    const inbox: DecryptedUserMessage[] = []
    // eslint-disable-next-line no-restricted-syntax
    for (const msg of res) {
      // eslint-disable-next-line no-await-in-loop
      const decryptedMsg = await this.messageDecoder(this.user, msg)
      inbox.push(decryptedMsg)
    }

    return inbox
  }

  public async sendMessage(to: string, body: Uint8Array): Promise<UserMessage> {
    const toKey = tryParsePublicKey(to)
    const res = await this.getUsersClient().sendMessage(
      (this.user as any).identity as Identity,
      toKey,
      body
    )
    return res
  }

  public async deleteMessage(id: string): Promise<void> {
    await this.getUsersClient().deleteInboxMessage(id)
  }

  private getUserAuth(): UserAuth {
    if (this.user.storageAuth === undefined) {
      throw new Error('Authentication Error')
    }

    return this.user.storageAuth
  }

  private getUsersClient(): Users {
    return this.initUsers(this.getUserAuth())
  }

  private initUsers(userAuth: UserAuth): Users {
    if (this.config?.usersInit) {
      return this.config.usersInit(userAuth)
    }

    return Users.withUserAuth(userAuth, {
      host: this.config?.textileHubAddress,
    })
  }

  messageDecoder = async (
    user: IUser,
    message: UserMessage
  ): Promise<DecryptedUserMessage> => {
    const identity = new PrivateKey((user.identity as any).privKey.slice(0, 32))
    const decryptedBody = await identity.decrypt(message.body)
    return { decryptedBody, ...message }
  }
}
