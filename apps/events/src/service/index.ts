import fs from 'fs'
import gql from 'graphql-tag'
import path from 'path'
import {
  EventBusSubscriberCb,
  RabbitMQEventBus,
  RabbitMQEventBusConfig,
} from '../bus'
import { getSchema } from '../lib'
import { EventHandlers } from '../types'
import { Publish } from '../types/event-producer'
import { handlers } from './handlers'

export type MessageHandlerContext = {
  logger: (...data: any[]) => void
}

export const messageHandlers: EventBusSubscriberCb = async (args) => {
  const handler = handlers[args.topic as keyof EventHandlers]
  if (!handler) {
    throw new Error(`Handler for message ${args.topic} not found`)
  }
  const context: MessageHandlerContext = {
    logger: console.log,
  }
  await handler(args.payload as any, context)
}

export const getPublish = () => {
  const publish: Publish = (data) => {
    return eventBus.publish({
      payload: data.payload,
      topic: data.topic,
    })
  }
  return publish
}

export const eventConsumerTypeDef = fs.readFileSync(
  path.join(__dirname, './event-consumer.graphql'),
  'utf-8'
)

export const eventbusConfig: RabbitMQEventBusConfig = {
  plugins: [],
  serviceName: 'service-1',
  publisher: {
    schema: getSchema(path.join(__dirname, 'schema-event.graphql')),
  },
  subscriber: {
    cb: messageHandlers,
    queries: gql`
      ${eventConsumerTypeDef}
    `,
    schema: getSchema(path.join(__dirname, 'generated/publisher.graphql')),
  },
}

export const eventBus = new RabbitMQEventBus(eventbusConfig)

let isInitialized = false

export const initServiceEventBus = async () => {
  if (!isInitialized) {
    await eventBus.init()
    isInitialized = true
  }

  return eventBus
}
