import dot from 'dotenv'
import { log } from '../lib/log'

dot.config()

export const config = {
  JWT: {
    PUBLIC: process.env.JWT_PUBLIC!,
    PRIVATE: process.env.JWT_PRIVATE!,
  },
  USER: {
    API_KEY: process.env.USER_API_KEY!,
    API_SECRET: process.env.USER_API_SECRET!,
  },
  TEXTILE: { API_URL: process.env.TEXTILE_API_URL! },
  API: {
    PORT: '3000',
    ENV: process.env.ENV!,
    BASE_URL: process.env.BASE_URL!,
    WS_AUTH_URL: 'ws://localhost:3000',
    DATABASE_URL: process.env.DATABASE_URL!,
  },
  VAULT: {
    SERVICE_URL: process.env.VAULT_SERVICE_URL!,
    SALT_SECRET: process.env.VAULT_SALT_SECRET!,
  },
}

export default config
