import { request } from '@resource/utils'

export const post = ({
  data,
  url,
  params,
}: {
  url: string
  data?: unknown
  params?: unknown
}): Promise<any> =>
  request({
    url: url,
    params: params,
    data: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

export const get = ({
  url,
  params,
}: {
  url: string
  params?: unknown
}): Promise<any> =>
  request({
    url: url,
    params: params,
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'GET',
  })
