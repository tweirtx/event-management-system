import * as fs from "fs";
import *as path from "path";
import {getAppDataPath} from "appdata-path";
import {Socket, Server} from "socket.io";
import {IRoom} from "./IRoom";
import logger from "../logger";

export default class EventRoom implements IRoom {
  private readonly _server: Server;
  private readonly _clients: Socket[];
  private readonly _name: string;

  constructor(server: Server) {
    this._server = server;
    this._clients = [];
    this._name = "event";
  }

  public addClient(client: Socket) {
    this._clients.push(client);
    this.initializeEvents(client);
    logger.info(`Client ${client.id} joined '${this._name}'.`);
  }

  public removeClient(client: Socket) {
    if (this._clients.indexOf(client) > -1) {
      this._clients.splice(this._clients.indexOf(client), 1);
      logger.info(`Client ${client.id} left ${this._name}'.`);
    }
  }

  public getClients(): Socket[] {
    return this._clients;
  }

  private initializeEvents(client: Socket) {
    client.on("request-config", () => {
      const fileName = path.resolve(getAppDataPath("") + "/ems-core/config.json");
      fs.readFile(fileName, ((err, data) => {
        if (err) {
          logger.error(err);
        }
        this._server.to(this._name).emit("config-receive", JSON.parse(data.toString()).eventConfig);
      }));
      // this._server.to(this._name).emit("config-receive", host);
    });
  }

  get name(): string {
    return this._name;
  }
}