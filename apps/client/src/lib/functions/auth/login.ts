import { Identities } from "@resource/rdk";
import sdk from "./sdk";

async function run() {
  const users = (await sdk.getUsers()) as Identities;
  const identity = await users.createIdentity();
  await users.authenticate(identity);
}

run().catch((e) => console.error(e));
