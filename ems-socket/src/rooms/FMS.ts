import * as fs from "fs";
import *as path from "path";
import {getAppDataPath} from "appdata-path";
import {Socket, Server} from "socket.io";
import {IRoom} from "./IRoom";
import logger from "../logger";
import {EMSProvider} from "@the-orange-alliance/lib-ems";
import * as net from "net";
import * as dgram from "dgram";

export default class FmsRoom implements IRoom {
  private readonly _server: Server;
  private readonly _clients: Socket[];
  private readonly _name: string;

  private allDriverStations: object[];

  constructor(server: Server) {
    this._server = server;
    this._clients = [];
    this._name = "fms";
    this.allDriverStations = [];
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
    client.on("ds-request-all", () => {
      client.emit("ds-all", JSON.stringify(this.allDriverStations));
    });
    client.on("fms-ping", () => {
      this._server.to(this._name).emit("fms-ping");
    });
    client.on("plc-update", (plcData: string) => {
      this._server.to(this._name).emit("plc-update", plcData);
    });
    client.on("fms-pong", () => {
      this._server.to(this._name).emit("fms-pong");
    });
    client.on("fms-settings-update", (data: string) => {
      this._server.to(this._name).emit("fms-settings-update", data);
    });
    client.on("fms-settings-update-success", (data: string) => {
      this._server.to(this._name).emit("fms-settings-update-success", data);
    });
    client.on("ds-update-all", (dsData: string) => {
      this.allDriverStations = JSON.parse(dsData);
      this._server.to(this._name).emit("ds-update", dsData);
    });
    client.on("fms-request-settings", () => {
      this._server.to(this._name).emit("fms-request-settings");
    });
    client.on("fms-settings", (data: string) => {
      this._server.to(this._name).emit("fms-settings", data);
    });
  }

  get name(): string {
    return this._name;
  }
}