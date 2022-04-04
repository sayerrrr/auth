import { codegen } from "@graphql-codegen/core";
import { getCachedDocumentNodeFromSchema } from "@graphql-codegen/plugin-helpers";
import * as typescript from "@graphql-codegen/typescript";
import * as typescriptOperations from "@graphql-codegen/typescript-operations";
import { GraphQLFileLoader } from "@graphql-tools/graphql-file-loader";
import { loadDocuments, loadSchema } from "@graphql-tools/load";
import * as eventBus from "@resource/codegen";
import { promises } from "fs";
import path from "path";
import prettier from "prettier";

const main = async () => {
  const loadedCDocuments = await loadDocuments(
    [path.join(process.cwd(), "src/service/graphql/consumer.gql")],
    {
      loaders: [new GraphQLFileLoader()],
    },
  );

  const loadedCSchema = await loadSchema(
    [path.join(process.cwd(), "src/service/graphql/events.gql")],
    {
      loaders: [new GraphQLFileLoader()],
    },
  );

  const loadedPSchema = await loadSchema(
    [path.join(process.cwd(), "src/service/graphql/events.gql")],
    {
      loaders: [new GraphQLFileLoader()],
    },
  );

  const cConfig = {
    skipTypename: true,
    useTypeImports: true,
    avoidOptionals: true,
  };

  const cDocumentNode = getCachedDocumentNodeFromSchema(loadedCSchema);
  const pDocumentNode = getCachedDocumentNodeFromSchema(loadedPSchema);

  const cFilename = path.join(process.cwd(), "../types/event-consumer.ts");
  const consumer = await codegen({
    schema: cDocumentNode,
    documents: loadedCDocuments,
    config: cConfig,
    filename: cFilename,
    pluginMap: {
      typescript,
      typescriptOperations,
      eventBus,
    },
    plugins: [
      {
        typescript: {},
      },

      {
        typescriptOperations: {},
      },
      {
        eventBus: {
          consumer: {
            eventSampler: true,
            schemaPrintPath: "./src/types/publisher.graphql",
          },
          scalars: {
            DateTime: "String",
            UUID: "String",
            EmailAddress: "String",
          },
        },
      },
    ],
  });

  await promises.writeFile(
    cFilename,
    prettier.format(consumer, {
      ...(await prettier.resolveConfig(process.cwd())),
      parser: "typescript",
    }),
    {
      encoding: "utf-8",
    },
  );

  const pConfig = {
    enumsAsTypes: true,
    skipTypename: true,
    useTypeImports: true,
    avoidOptionals: true,
  };
  const pFilename = path.join(process.cwd(), "../types/event-producer.ts");
  const producer = await codegen({
    schema: pDocumentNode,
    documents: loadedCDocuments,
    config: pConfig,
    filename: pFilename,
    pluginMap: {
      typescript,
      typescriptOperations,
      eventBus,
    },
    plugins: [
      {
        typescript: {},
      },

      {
        typescriptOperations: {},
      },
      {
        eventBus: {
          publisher: true,
          scalars: {
            DateTime: "String",
            UUID: "String",
            EmailAddress: "String",
          },
        },
      },
    ],
  });

  await promises.writeFile(
    pFilename,
    prettier.format(producer, {
      ...(await prettier.resolveConfig(process.cwd())),
      parser: "typescript",
    }),
    {
      encoding: "utf-8",
    },
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
