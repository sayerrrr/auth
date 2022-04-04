import { PrivateKey } from '@textile/crypto'
import fs from 'fs'
import localForage from 'localforage'
import omit from 'lodash/omit'
import values from 'lodash/values'

export class BrowserStorage {
  private db: LocalForage

  constructor() {
    this.db = localForage.createInstance({ name: 'user-ids' })
  }

  async add(identity: PrivateKey): Promise<void> {
    await this.db.setItem(identity.public.toString(), identity.toString())
  }

  async list(): Promise<PrivateKey[]> {
    const ids: PrivateKey[] = []
    await this.db.iterate((value: string) => {
      try {
        value && ids.push(PrivateKey.fromString(value))
      } catch (e) {}
    })
    return ids
  }

  async remove(key: string): Promise<void> {
    await this.db.setItem(key, null)
  }
}

export class FileStorage {
  private filename: string

  private identities: Record<string, string>

  constructor(filename: string) {
    this.filename = filename

    const jsonString =
      (fs.existsSync(filename) && fs.readFileSync(filename).toString()) || '{}'
    this.identities = JSON.parse(jsonString)
  }

  private async write(): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(this.filename, JSON.stringify(this.identities), (err) => {
        err ? reject(err) : resolve()
      })
    })
  }

  async add(identity: PrivateKey): Promise<void> {
    this.identities[identity.public.toString()] = identity.toString()
    await this.write()
  }

  async list(): Promise<PrivateKey[]> {
    return values(this.identities).map((idString) =>
      PrivateKey.fromString(idString)
    )
  }

  async remove(key: string): Promise<void> {
    this.identities = omit(this.identities, [key])
    await this.write()
  }
}
