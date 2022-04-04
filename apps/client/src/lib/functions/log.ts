import { Logger } from "tslog";

const logger: Logger = new Logger({
  name: "root",
  displayDateTime: false,
  displayLogLevel: false,
  displayLoggerName: false,
});

export const log = (...args: any | any[]) => logger.info(...args);
