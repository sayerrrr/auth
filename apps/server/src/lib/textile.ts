import { createAPISig, Client } from '@textile/hub'
import config from '../config'

/**
 * getAPISig uses helper function to create a new sig
 *
 * seconds (300) time until the sig expires
 */
export const getAPISig = async (seconds: number = 300) => {
  const expiration = new Date(Date.now() + 1000 * seconds)
  return await createAPISig(config.USER.API_SECRET!, expiration)
}

/**
 * newClientDB creates a Client (remote DB) connection to the Hub
 *
 * A Hub connection is required to use the getToken API
 */
export const createHubClient = async () => {
  const API = config.TEXTILE.API_URL!
  const client = await Client.withKeyInfo(
    {
      key: config.USER.API_KEY!,
      secret: config.USER.API_SECRET!,
    },
    API
  )

  return client
}
