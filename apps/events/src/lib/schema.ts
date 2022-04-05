import { makeExecutableSchema } from '@graphql-tools/schema'
import fs from 'fs'
import { GraphQLSchema } from 'graphql'
import {
  DateTimeResolver,
  EmailAddressResolver,
  UUIDResolver,
} from 'graphql-scalars'
import gql from 'graphql-tag'

export const getSchema = (location: string): GraphQLSchema => {
  const eventTypeDefs = fs.readFileSync(location, {
    encoding: 'utf-8',
  })

  const typeDefs = gql`
    ${eventTypeDefs}
  `

  const resolvers = {
    UUID: UUIDResolver,
    DateTime: DateTimeResolver,
    EmailAddress: EmailAddressResolver,
  }

  return makeExecutableSchema({
    typeDefs,
    resolvers,
  })
}
