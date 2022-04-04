import { DocumentNode, GraphQLSchema } from "graphql";
import { GraphQLEventbusMetadata } from "./Eventbus";

export type EventBusSubscriberCb = (props: {
  topic: string;
  payload: {};
  _fullData: {};
  metadata: GraphQLEventbusMetadata;
}) => Promise<unknown>;

export interface SubscriberConfig {
  queries: DocumentNode;
  schema: GraphQLSchema;
  cb: EventBusSubscriberCb;
}

export interface PublisherConfig {
  schema: GraphQLSchema;
}
