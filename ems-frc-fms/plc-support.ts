import logger from "./logger";
import {ReadCoilResult, ReadRegisterResult} from "modbus-serial/ModbusRTU";
import {EMSProvider, SocketProvider} from "@the-orange-alliance/lib-ems";
import {PlcInputs} from "./models/PlcInputs";
import {PlcOutputCoils} from "./models/PlcOutputCoils";
import {DriverstationSupport} from "./driverstation-support";

// Modbus Crash Course
// Registers: ?Counters?
// Inputs: Discrete Inputs (E-Stops)
// Coils: Outputs to PLC (Stack lights, LED Strips, Etc)

export class PlcSupport {
  private static _instance: PlcSupport;

  private ModbusRTU = require('modbus-serial');

  private modBusPort = 502;

  private client = new this.ModbusRTU();
  private plc = new PlcStatus();

  private firstConn = false;

  public static getInstance(): PlcSupport {
    if (typeof PlcSupport._instance === "undefined") {
      PlcSupport._instance = new PlcSupport();
    }
    return PlcSupport._instance;
  }

  public initPlc(address: string) {
    this.plc.address = address;
    this.client.connectTCP(this.plc.address, { port: this.modBusPort }).then(() => {
      logger.info('✅ Connected to PLC at ' + this.plc.address + ':' + this.modBusPort);
    }).catch((err: any) => {
      logger.info('❌ Failed to connect to PLC: ' + err);
      this.firstConn = true;
    });
    logger.info('➖ Attempting to connect to PLC');
    this.client.setID(1);
  }

  public runPlc() {
    if(!this.client.isOpen) {
      if(this.firstConn) {
        logger.info('Lost connection to PLC, retrying');
        this.firstConn = false;
        this.initPlc(this.plc.address);
      }
    } else {
      this.client.readHoldingRegisters(0, 10).then((data: ReadRegisterResult) =>{
        this.plc.registers = data.data;
      });

      this.client.readDiscreteInputs(0, this.plc.inputs.inputCount).then((data:ReadCoilResult) => {
        this.plc.inputs.fromArray(data.data);
        if(!this.plc.inputs.equals(this.plc.oldInputs)) {
          // We have a new input, lets notify
          SocketProvider.emit("plc-update", this.plc.inputs.toJSON());
          this.plc.oldInputs = this.plc.inputs;
        }
      });

      if(this.plc.oldCoils.equals(this.plc.coils)) {
        this.plc.coils.heartbeat = true;
        this.client.writeCoils(0, this.plc.coils.getCoilArray()).then(() => {
          this.plc.oldCoils = this.plc.coils;
        }).catch((err: any) => {
          logger.info('Error writing coils: ' + err);
        });
      }
    }
  }

  public checkEstops() {
    // Update Driver Stations if E-STOP, Stop Match is Master E-STOP
    if(this.plc.inputs.fieldEstop) {
      // Abort Match, Field ESTOP pressed
      SocketProvider.emit('abort');
      DriverstationSupport.getInstance().setTeamEstopped(0);
      DriverstationSupport.getInstance().setTeamEstopped(1);
      DriverstationSupport.getInstance().setTeamEstopped(2);

      DriverstationSupport.getInstance().setTeamEstopped(3);
      DriverstationSupport.getInstance().setTeamEstopped(4);
      DriverstationSupport.getInstance().setTeamEstopped(5);
    }
    if(this.plc.inputs.redEstop1) DriverstationSupport.getInstance().setTeamEstopped(0);
    if(this.plc.inputs.redEstop2) DriverstationSupport.getInstance().setTeamEstopped(1);
    if(this.plc.inputs.redEstop3) DriverstationSupport.getInstance().setTeamEstopped(2);

    if(this.plc.inputs.blueEstop1) DriverstationSupport.getInstance().setTeamEstopped(3);
    if(this.plc.inputs.blueEstop2) DriverstationSupport.getInstance().setTeamEstopped(4);
    if(this.plc.inputs.blueEstop3) DriverstationSupport.getInstance().setTeamEstopped(5);
  }

  public setStationStack(station: number, status: number) {
    switch(station) {
      case 0: this.plc.coils.redOneConn = status === STACK_LIGHT_ON; break;
      case 1: this.plc.coils.redTwoConn = status === STACK_LIGHT_ON; break;
      case 2: this.plc.coils.redThreeConn = status === STACK_LIGHT_ON; break;
      case 3: this.plc.coils.blueOneConn = status === STACK_LIGHT_ON; break;
      case 4: this.plc.coils.blueTwoConn = status === STACK_LIGHT_ON; break;
      case 5: this.plc.coils.blueThreeConn = status === STACK_LIGHT_ON; break;
    }
  }

  public setAllStationStacks(status: number) {
    this.plc.coils.redOneConn = status === STACK_LIGHT_ON;
    this.plc.coils.redTwoConn = status === STACK_LIGHT_ON;
    this.plc.coils.redThreeConn = status === STACK_LIGHT_ON;
    this.plc.coils.blueOneConn = status === STACK_LIGHT_ON;
    this.plc.coils.blueTwoConn = status === STACK_LIGHT_ON;
    this.plc.coils.blueThreeConn = status === STACK_LIGHT_ON;
  }

  public soundBuzzer() {
    // Sound buzzer for 1.5 seconds
    this.plc.coils.stackLightBuzzer = true;
    setTimeout(() => {
      this.plc.coils.stackLightBuzzer = false;
    }, 1500);
  }

  public setFieldStack(blue: number, red: number, orange: number, green: number, buzzer: number) {
    this.plc.coils.stackLightBlue = blue === STACK_LIGHT_ON;
    this.plc.coils.stackLightRed = red === STACK_LIGHT_ON;
    this.plc.coils.stackLightOrange = orange === STACK_LIGHT_ON;
    this.plc.coils.stackLightGreen = green === STACK_LIGHT_ON;
    this.plc.coils.stackLightBuzzer = buzzer === STACK_LIGHT_ON;
  }

  public onPrestart() {
    this.setAllStationStacks(STACK_LIGHT_ON);
    this.setFieldStack(STACK_LIGHT_ON, STACK_LIGHT_ON, STACK_LIGHT_OFF, STACK_LIGHT_OFF, STACK_LIGHT_OFF);
  }
}

class PlcStatus {
  public isHealthy: boolean;
  public address: string;
  public inputs: PlcInputs;
  public registers: number[];
  public coils: PlcOutputCoils;
  public oldInputs: PlcInputs;
  public oldRegisters: [];
  public oldCoils: PlcOutputCoils;
  public cycleCounter: number;
  constructor() {
    this.isHealthy = false;
    this.address = '10.0.100.10';
    this.inputs = new PlcInputs();
    this.registers = [];
    this.coils = new PlcOutputCoils();
    this.oldInputs = new PlcInputs();
    this.oldRegisters = [];
    this.oldCoils = new PlcOutputCoils();
    this.cycleCounter = -1;
  }
}

export default PlcSupport.getInstance();

export const STACK_LIGHT_OFF = 0;
export const STACK_LIGHT_ON = 1;
