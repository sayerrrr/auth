import { Logger } from 'tslog'

const logger: Logger = new Logger({
  name: 'root',
  displayDateTime: false,
  displayLogLevel: false,
  displayLoggerName: false,
})

export const log = (...args) => logger.info(...args)
