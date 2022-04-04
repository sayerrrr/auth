import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import invariant from 'tiny-invariant'

/**
 * A lightweight wrapper for axios - a Promise based HTTP client for the browser and node.js
 * see https://github.com/axios/axios#request-config for config options
 */
export const request = async (
  options: AxiosRequestConfig
): Promise<
  | AxiosResponse<any, any>
  | string |{
      status: string
      data: Record<string, unknown>
      headers: Record<string, unknown>
    }
> => {
  invariant(options.baseURL, 'baseURL is required')

  /**
   * Create an Axios Client with baseURL as default
   */
  const client = axios.create({
    baseURL: options.baseURL,
  })

  const onSuccess = (response: AxiosResponse<any, any>) => response

  const onError = (error: {
    config: Record<string, unknown>
    response: {
      status: string
      data: Record<string, unknown>
      headers: Record<string, unknown>
    }
    message: string
  }) => {
    console.error('Request failed:', error.config)

    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Data:', error.response.data)
      console.error('Headers:', error.response.headers)
    } else {
      console.error('Error Message:', error.message)
    }

    return error.response || error.message
  }

  return await client(options).then(onSuccess).catch(onError)
}
