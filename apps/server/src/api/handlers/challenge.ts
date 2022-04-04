import Hapi from '@hapi/hapi'
import { defer, lastValueFrom, throwError } from 'rxjs'
import { catchError, map, take } from 'rxjs/operators'

import config from '../../config'
import { log } from '../../lib/log'
import { SignatureModel } from '../../models'

interface ChallengePayload {
  data: {
    sig: string
    pubkey: string
  }
}

/* env */
const STAGE = config.API.ENV

/* models */
const sigDb = new SignatureModel(STAGE)

export const challenge = {
  name: 'challenge',
  register: async (s: Hapi.Server) => {
    s.route({
      method: 'POST',
      path: '/challenge',
      handler: handler,
    })
  },
}

const handler = async (r: Hapi.Request, h: Hapi.ResponseToolkit) => {
  try {
    const { data } = r.payload as ChallengePayload

    if (!data.sig || !data.pubkey) {
      return h
        .response({
          error:
            'Missing params: ' +
            JSON.stringify({
              sig: data.sig ?? 'missing',
              pubkey: data.pubkey ?? 'missing',
            }),
        })
        .code(400)
    }

    const sig = await sigDb.createSignature(data.pubkey, data.sig)

    log('challenge sig: ' + JSON.stringify(sig))

    return h.response({ ...sig }).code(200)
  } catch (e: any) {
    log('error: ', { path: h.request.path, error: e })
    return h.response().code(400)
  }
}
