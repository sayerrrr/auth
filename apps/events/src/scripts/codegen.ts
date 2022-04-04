import { codegen } from '@graphql-codegen/core'
import { getCachedDocumentNodeFromSchema } from '@graphql-codegen/plugin-helpers'
import * as typescript from '@graphql-codegen/typescript'
import * as typescriptOperations from '@graphql-codegen/typescript-operations'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import { loadDocuments, loadSchema } from '@graphql-tools/load'
import * as events from '@resource/codegen'
import { promises } from 'fs'
import path from 'path'
import prettier from 'prettier'

const main = async () => {
  const loadedCDocuments = await loadDocuments(
    [path.join(process.cwd(), 'src/service/graphql/consumer.gql')],
    {
      loaders: [new GraphQLFileLoader()],
    }
  )

  const loadedCSchema = await loadSchema(
    [path.join(process.cwd(), 'src/service/graphql/events.gql')],
    {
      loaders: [new GraphQLFileLoader()],
    }
  )

  const loadedPSchema = await loadSchema(
    [path.join(process.cwd(), 'src/service/graphql/events.gql')],
    {
      loaders: [new GraphQLFileLoader()],
    }
  )

  const cConfig = {
    skipTypename: true,
    useTypeImports: true,
    avoidOptionals: true,
  }

  const cDocumentNode = getCachedDocumentNodeFromSchema(loadedCSchema)
  const pDocumentNode = getCachedDocumentNodeFromSchema(loadedPSchema)

  const cFilename = path.join(
    process.cwd(),
    '../events/src/types/event-consumer.ts'
  )
  const consumer = await codegen({
    schema: cDocumentNode,
    documents: loadedCDocuments,
    config: cConfig,
    filename: 'event-consumer.ts',
    pluginMap: {
      typescript,
      typescriptOperations,
      events,
    },
    plugins: [
      {
        typescript: {},
      },

      {
        typescriptOperations: {},
      },
      {
        events: {
          consumer: {
            eventSampler: true,
            schemaPrintPath: './src/types/publisher.graphql',
            contextType: './context#HandlerContext',
          },
          scalars: {
            DateTime: 'String',
            UUID: 'String',
            EmailAddress: 'String',
          },
        },
      },
    ],
  })

  await promises.writeFile(
    cFilename,
    prettier.format(consumer, {
      semi: false,
      singleQuote: true,
      trailingComma: 'es5',
      arrowParens: 'always',
      printWidth: 80,
      parser: 'typescript',
    }),
    {
      encoding: 'utf-8',
    }
  )

  const pConfig = {
    enumsAsTypes: true,
    skipTypename: true,
    useTypeImports: true,
    avoidOptionals: true,
  }
  const pFilename = path.join(
    process.cwd(),
    '../events/src/types/event-producer.ts'
  )

  const producer = await codegen({
    schema: pDocumentNode,
    documents: loadedCDocuments,
    config: pConfig,
    filename: 'event-producer.ts',
    pluginMap: {
      typescript,
      typescriptOperations,
      events,
    },
    plugins: [
      {
        typescript: {},
      },

      {
        typescriptOperations: {},
      },
      {
        events: {
          publisher: true,
          scalars: {
            DateTime: 'String',
            UUID: 'String',
            EmailAddress: 'String',
          },
        },
      },
    ],
  })

  await promises.writeFile(
    pFilename,
    prettier.format(producer, {
      semi: false,
      singleQuote: true,
      trailingComma: 'es5',
      arrowParens: 'always',
      printWidth: 80,
      parser: 'typescript',
    }),
    {
      encoding: 'utf-8',
    }
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
