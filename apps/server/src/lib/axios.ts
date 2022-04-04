import axios from 'axios'
import config from '../config'

/**
 * Create an Axios Client with baseURL as default
 */
const client = axios.create({
  baseURL: config.API.BASE_URL,
})

/**
 * A lightweight wrapper for axios - a Promise based HTTP client for the browser and node.js
 * see https://github.com/axios/axios#request-config for config options
 */
export const request = async (options: {}) => {
  const onSuccess = (response: {}) => response

  const onError = (error: {
    config: {}
    response: { status: string; data: {}; headers: {} }
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

const onError = (e) => {
  if (axios.isCancel(e)) {
    return { message: e.message, status: 500, context: e }
  } else {
    if (e.response) {
      return {
        message: e.message,
        status: e.response.status,
        context: e.response,
      }
    } else if (e.request) {
      return {
        message: 'No response was received',
        status: 404,
        context: e.request,
      }
    } else {
      return {
        message: 'Something wrong happened in setting up the request',
        status: 500,
        context: { message: e.message },
      }
    }
  }
}
