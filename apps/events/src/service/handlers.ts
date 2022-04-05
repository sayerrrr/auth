import { HandlerContext } from '../types/context'
import {
  ChallengeEventQuery,
  EventHandlers,
  SignatureEventQuery,
} from '../types/event-consumer'

export const handlers: EventHandlers = {
  SendChallengeEvent: async (
    msg: ChallengeEventQuery['SendChallengeEvent'],
    ctx: HandlerContext
  ) => {},
  SendSignatureEvent: async (
    msg: SignatureEventQuery['SendSignatureEvent'],
    ctx: HandlerContext
  ) => {},
  SendAuthEvent: async () => {},
}
