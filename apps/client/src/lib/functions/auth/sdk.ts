import { FileStorage, Identities, UserStorage } from "@resource/rdk";
import { config } from "../../config";
import { log } from "../log";

const EVENTS = {
  ready: "ready",
};

export class SDK {
  isStarting = true;
  users: Identities | null = null;
  cbs: Record<any, any> = {};

  constructor() {
    this.init();
  }

  init = async () => {
    this.users = await Identities.withStorage(
      new FileStorage("./tmp/tmp.json"),
      {
        endpoint: config.API.WS_AUTH_URL,
        vaultServiceConfig: {
          serviceUrl: config.VAULT.SERVICE_URL,
          saltSecret: config.VAULT.SALT_SECRET,
        },
      },
      (error: unknown) => {
        log("error", error);
      }
    );

    this.isStarting = false;

    if (this.cbs[EVENTS.ready] && this.cbs[EVENTS.ready].length > 0) {
      this.cbs[EVENTS.ready].forEach((cb: any) => {
        cb.call(null);
      });
    }
  };

  getUsers = async () => {
    if (!this.users) {
      await this.init();
    }

    return this.users;
  };

  getStorage = async () => {
    if (!this.users) {
      await this.init();
    }

    const usersList = (this.users && this.users.list()) ?? [];
    if (usersList.length > 0) {
      return new UserStorage(usersList[0], {
        textileHubAddress: config.TEXTILE.API_URL,
        debugMode: process.env.REACT_APP_FE_NODE_ENV !== "production",
      });
    }
  };

  onListen = (event: any, cb: any) => {
    if (typeof this.cbs[event] === "undefined") {
      this.cbs[event] = [];
    }

    this.cbs[event].push(cb);

    return () => {
      this.cbs[event] = this.cbs[event].filter((_cb: any) => _cb !== cb);
    };
  };
}

export default new SDK();
