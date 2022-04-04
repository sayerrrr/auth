export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K]
}
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>
}
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>
}
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string
  String: string
  Boolean: boolean
  Int: number
  Float: number
}

export type Query = {
  SendChallengeEvent: SendChallengeEvent
  SendAuthEvent: SendAuthEvent
  SendSignatureEvent: SendSignatureEvent
}

export type SendChallengeEvent = {
  eventId: Scalars['String']
  type: Scalars['String']
  value: Scalars['String']
}

export type SendSignatureEvent = {
  eventId: Scalars['String']
  type: Scalars['String']
  payload: Signature
}

export type SendAuthEvent = {
  eventId: Scalars['String']
  type: Scalars['String']
  payload: AuthData
}

export type AuthData = {
  id: Scalars['String']
  pubkey: Scalars['String']
  version: Scalars['Int']
}

export type Signature = {
  sig: Scalars['String']
  pubkey: Scalars['String']
}

export type ChallengeEventQueryVariables = Exact<{ [key: string]: never }>

export type ChallengeEventQuery = {
  SendChallengeEvent: { type: string; value: string }
}

export type SignatureEventQueryVariables = Exact<{ [key: string]: never }>

export type SignatureEventQuery = {
  SendSignatureEvent: { type: string; payload: { sig: string; pubkey: string } }
}

export type AuthEventQueryVariables = Exact<{ [key: string]: never }>

export type AuthEventQuery = {
  SendAuthEvent: {
    type: string
    payload: { id: string; pubkey: string; version: number }
  }
}

function publish(
  data:
    | { topic: 'SendChallengeEvent'; payload: SendChallengeEvent }
    | { topic: 'SendAuthEvent'; payload: SendAuthEvent }
    | { topic: 'SendSignatureEvent'; payload: SendSignatureEvent }
): Promise<void>
function publish(): Promise<void> {
  return Promise.resolve()
}

export type Publish = typeof publish
