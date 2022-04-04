import Hapi from '@hapi/hapi'
import ws from '@hapi/nes'
import b from '@hapi/bourne'
import { auth, identity, token, challenge } from './api'
import { log } from './lib/log'

export const createServer = async (): Promise<Hapi.Server> => {
  const server: Hapi.Server = Hapi.server({
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
  })

  await Promise.all([
    server.register(auth, {
      routes: {
        prefix: '/api',
      },
    }),
    server.register(identity, {
      routes: {
        prefix: '/api',
      },
    }),
    server.register(token, {
      routes: {
        prefix: '/api',
      },
    }),
    server.register(challenge, {
      routes: {
        prefix: '/api',
      },
    }),
  ])

  await server.initialize()

  return server
}

export const startServer = async (server: Hapi.Server): Promise<Hapi.Server> =>
  await server.start().then(() => server)

process.on('unhandledRejection', (err) => {
  console.log(err)
  process.exit(1)
})
