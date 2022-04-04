import { createServer, startServer } from './server'
import dot from 'dotenv'
import { log } from './lib/log'

dot.config()

createServer()
  .then(startServer)
  .then(() => log('Server started on: ' + process.env.PORT))
  .catch((err) => {
    console.log(err)
  })
