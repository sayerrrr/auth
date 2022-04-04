export enum VaultItemType {
  PrivateKeyWithMnemonic = 'PrivateKeyWithMnemonic',
}

export enum VkVersion {
  VkVersion1 = 'V1',
}

/**
 * Object representing item stored or retrieved from the vault.
 *
 */
export interface VaultItem {
  itemType: VaultItemType
  value: string
}

export enum VaultBackupType {
  Google = 'google',
  Twitter = 'twitter',
  Email = 'email',
}

export interface Vault {
  retrieve: (
    uuid: string,
    passphrase: string,
    backupType: VaultBackupType
  ) => Promise<VaultItem[]>

  store: (
    uuid: string,
    passphrase: string,
    backupType: VaultBackupType,
    item: VaultItem[],
    metadata: Record<string, string>
  ) => Promise<void>
}

export interface VaultServiceConfig {
  saltSecret: string
  serviceUrl: string
}
