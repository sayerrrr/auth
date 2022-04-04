import Hapi from '@hapi/hapi'

import config from '../../config'
import { getAPISig } from '../../lib/textile'

export const auth = {
  name: 'auth',
  register: async (s: Hapi.Server) => {
    s.route({
      method: 'GET',
      path: '/auth',
      handler: authCreate,
    })
  },
}

const authCreate = async (r: Hapi.Request, h: Hapi.ResponseToolkit) => {
  try {
    const auth = await getAPISig()

    return h
      .response({
        ...auth,
        key: config.USER.API_KEY!,
      })
      .code(200)
  } catch (e: any) {
    r.log('error: ', e)
    return h.response().code(500)
  }
}

export const identity = {
  name: 'identity',
  register: async (s: Hapi.Server) => {
    s.route({
      method: 'GET',
      path: '/create',
      handler: identityCreate,
    })
  },
}

const identityCreate = async (r: Hapi.Request, h: Hapi.ResponseToolkit) => {
  try {
    const auth = await getAPISig()

    return h
      .response({
        ...auth,
        key: config.USER.API_KEY!,
      })
      .code(200)
  } catch (e: any) {
    r.log('error: ', e)
    return h.response().code(500)
  }
}
