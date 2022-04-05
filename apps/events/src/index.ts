import { v4 } from 'uuid'
import { getPublish, initServiceEventBus } from './service/'

const publish = getPublish()

const foo = async () => {
  await initServiceEventBus()

  setInterval(() => {
    publish({
      topic: 'SendChallengeEvent',
      payload: {
        eventId: v4(),
        type: 'challenge',
        value: 'lhbsadfihbasd76',
      },
    })
  }, 5000)
}

foo()
