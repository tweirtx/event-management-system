import * as dgram from "dgram";
import * as net from "net";
import DSConn from "./models/DSConn"
import logger from "./logger";
import {EmsFrcFms} from "./server";
import Match from "@the-orange-alliance/lib-ems/dist/models/ems/Match";

const udpDSListener = dgram.createSocket("udp4");
let tcpListener = net.createServer();


export class DriverstationSupport {

    private dsTcpListenPort     = 1750;
    private dsUdpSendPort       = 1121;
    private dsUdpReceivePort    = 1160;
    private dsTcpLinkTimeoutSec = 5;
    private dsUdpLinkTimeoutSec = 1;
    private maxTcpPacketBytes   = 4096;

    private allDriverStations: Array<DSConn> = new Array(6);

    private static _instance: DriverstationSupport;

    public constructor() {
    }

    public static getInstance(): DriverstationSupport {
        if (typeof DriverstationSupport._instance === "undefined") {
            DriverstationSupport._instance = new DriverstationSupport();
        }
        return DriverstationSupport._instance;
    }

    dsInit(host: string): any {
        this.udpInit(this.dsUdpReceivePort, host);
        this.tcpInit(this.dsTcpListenPort, host);
    }

    // Init the UDP Server: This listens for new drivers stations
    private udpInit(port: number, host: string) {
        udpDSListener.on('listening', function() {
            const address = udpDSListener.address();
            logger.info('Listening for DriverStations on UDP ' + address.address + ':' + address.port);
        });

        udpDSListener.on('error', function() {
            const address = udpDSListener.address();
            logger.info('Error Listening for DriverStations on UDP ' + address.address + ':' + address.port + '. Please make sure you IP Address is set correctly.');
        });

        // Listen for New UDP Packets
        udpDSListener.on('message', (data: Buffer, remote) => {
            this.parseUDPPacket(data, remote);
        });

        udpDSListener.bind(port, host);
    }

    // Parse a UDP packet from the Driver Station
    private parseUDPPacket(data: Buffer, remote: any) {
        const teamNum = data[4]<<8 + data[5];
        if(teamNum) { // if team id is defined
            for(const i in this.allDriverStations) { // run through current driver staions
                if(this.allDriverStations[i].teamId === teamNum) { // found team in DS list
                    this.allDriverStations[i].dsLinked = true;
                    this.allDriverStations[i].lastPacketTime = Date.now();

                    this.allDriverStations[i].radioLinked = (data[3]&0x10) !== 0;
                    this.allDriverStations[i].robotLinked = (data[3]&0x20) !== 0;
                    if (this.allDriverStations[i].robotLinked) {
                        this.allDriverStations[i].lastRobotLinkedTime = Date.now();
                        // Robot battery voltage, stored as volts * 256.
                        this.allDriverStations[i].batteryVoltage = data[6] + data[7]/256;
                    }
                }
            }
            // if for loop exits, we didn't find team in active match
            logger.info('Not connecting to ' + teamNum + '\'s driver station. (Not in active match) Refusing connection');
        } else {
            logger.info('Couldn\'t decipher team number from UDP packet');
        }
    }

    // Init the TCP server: This create connections to each Driver Station
    private tcpInit(port: number, host: string) {
        tcpListener = net.createServer((socket: net.Socket) => {
            //socket.pipe(socket);
        });

        tcpListener.listen(port, host);

        tcpListener.on("listening", () => {
            logger.info('Listening for DriverStations on TCP ' + host + ':' + port);
        });

        tcpListener.on("connection", (socket: net.Socket) => {
            if(this.allDriverStations[0]) {
                logger.info(`New DS TCP Connection Established for ${socket.remoteAddress}:${socket.remotePort}`);
                // this should read the first packet and assign the TCP connection to the proper alliance member
                socket.on('data', (chunk: Buffer) => {
                    this.parseTcpPacket(chunk, socket);
                });

                socket.on("timeout", (err: Error) => logger.info("Driver Station TCP Timeout"));
                socket.on("close", (wasError: boolean) => logger.info("Driver Station TCP Closed. Error: " + wasError));
                socket.on("error", (err: Error) => logger.info('Error occurred on Driver Station TCP socket: ' + err.message));
            } else {
                socket.destroy();
            }
        });

        tcpListener.on("close", () => logger.info('DriverStation TCP Listener Closed'));

        tcpListener.on('error', (chunk: Buffer) => {
            logger.info('Driver Station TCP listener Error.');
        });
    }

    // Parse TCP packet from the Driver STation
    private parseTcpPacket(chunk: Buffer, socket: net.Socket) {
        const teamId = (chunk[3]<<8) + (chunk[4]);
        let station = -1;
        let recievedFirstPacket = false;
        if(this.allDriverStations[0]) { // Checks if we have driver stations
            for(const ds of this.allDriverStations) {
                if(ds && ds.teamId === teamId) {
                    station = ds.allianceStation;
                    recievedFirstPacket = ds.recievedFirstPacket;
                    break;
                }
            }

            if(station > -1 && !recievedFirstPacket) {
                this.handleFirstTCP(chunk, socket, teamId, station);
            } else if (station > -1 && recievedFirstPacket) {
                this.handleRegularTCP(chunk, socket, teamId, station);
            } else {
                logger.info('Rejecting DS Connection from team ' + teamId + ' who is not in the current match.');
                setTimeout(function(){ // wait before disconnecting
                    socket.destroy();
                }, 1000);
            }
        } else {
            // logger.info('Driver Station tried connection, but failed due to no active match'); // Clogs u
            socket.destroy();
        }
    }

    // parse a regular TCP packet
    private handleRegularTCP(chunk: Buffer, socket: net.Socket, teamId: number, station: number) {
        const packetType = chunk[2];
        switch (packetType) {
            case 28: break; // DS KeepAlive Packet, do nothing
            case 22:
                this.decodeStatusPacket(chunk.slice(2), station);
        }
        // TODO Log packet when match is in progress
    }

    // Parse the initial packet that the driver station sends
    private handleFirstTCP(chunk: Buffer, socket: net.Socket, teamId: number, station: number) {
        if(chunk.length < 5) {
            // invalid TCP packet, ignore
            socket.destroy();
            return;
        }
        const teamFromPacket = (chunk[3]<<8) + chunk[4];
        logger.info('First TCP recieved, team: ' + teamFromPacket);
        // Read the team number from the IP address to check for a station mismatch.
        let dsStationStatus = 0;
        const ipAddress = socket.remoteAddress;
        if(!ipAddress) {
            logger.info('Could not get IP address from first TCP packet. Ignoring.');
            return;
        }
        const teamRegex = new RegExp("\\d+\\.(\\d+)\\.(\\d+)\\.");
        const teamDigits = teamRegex.exec(ipAddress);
        if (!teamDigits) {
            logger.info('Could not get team number from IP Address. Ignoring.');
            return;
        }
        const td1 = parseInt(teamDigits[1]);
        const td2 = parseInt(teamDigits[2]);
        const stationTeamId = (td1*100) + td2;
        if(stationTeamId != teamFromPacket) {
            logger.info(`Team ${teamId} is in the incorrect station (Currently at ${stationTeamId}'s Station)`);
            dsStationStatus = 1;
        }
        let returnPacket: Buffer = Buffer.alloc(5);
        returnPacket[0] = 0; // Packet Size
        returnPacket[1] = 3; // Packet Size
        returnPacket[2] = 25; // Packet Type
        returnPacket[3] = station;
        returnPacket[4] = dsStationStatus;

        /*
        const packetStream = new stream.PassThrough();
        packetStream.end(returnPacket, ()=> {

        });*/
        if(socket.write(returnPacket)) {
            logger.info(`Sent first packet to driver station for team ${teamId}. Accepted.`); // TODO: Include Station # and color in log
            this.allDriverStations[station] = this.newDSConnection(teamId, station, socket);
        } else {
            logger.info('Failed to send first packet to team ' + teamId + '\'s driver station');
        }
    }

    // Create a new DS Connection Object
    private newDSConnection(teamId: number, allianceStation: number, tcpConn: net.Socket): DSConn {
        const newDs = new DSConn();
        newDs.recievedFirstPacket = true;
        newDs.tcpConn = tcpConn;
        newDs.udpConn = dgram.createSocket("udp4");
        if(tcpConn.remoteAddress) newDs.ipAddress = tcpConn.remoteAddress;
        newDs.allianceStation = allianceStation;
        this.sendControlPacket(newDs);
        return new DSConn();
    }

    // Run all this stuff
    public runDriverStations() {
        for(const i in this.allDriverStations) {
            if(this.allDriverStations[i] && this.allDriverStations[i].dsLinked){
                this.sendControlPacket(this.allDriverStations[i]);
                const diff = Date.now() - new Date(this.allDriverStations[i].lastPacketTime).getDate();
                if(Math.abs(diff/1000) > this.dsTcpLinkTimeoutSec) {
                    this.allDriverStations[i].dsLinked = false;
                    this.allDriverStations[i].radioLinked = false;
                    this.allDriverStations[i].robotLinked = false;
                    this.allDriverStations[i].batteryVoltage = 0;
                }
                this.allDriverStations[i].secondsSinceLastRobotLink = Math.abs(diff/1000);
            }

        }
    }

    // Send Control Packet
    private sendControlPacket(ds: DSConn) {
        const packet = this.constructControlPacket(ds);
        if(ds.udpConn) {
            ds.udpConn.emit("");
            ds.udpConn.send(packet, this.dsUdpSendPort, ds.ipAddress, (err) => {
                // Yes?
            });
        }
    }

    // Things to do on match start
    public driverStationMatchStart() {
        for(const ds in this.allDriverStations) {
            this.allDriverStations[ds].missedPacketOffset = this.allDriverStations[ds].missedPacketCount;
        }
    }

    // Close all connections to the driver station
    private closeDsConn(dsNum: number) {
        if(this.allDriverStations[dsNum] && this.allDriverStations[dsNum].udpConn) {
            this.allDriverStations[dsNum].udpConn.close();
        }
        if(this.allDriverStations[dsNum] && this.allDriverStations[dsNum].tcpConn) {
            this.allDriverStations[dsNum].tcpConn.destroy();
        }
    }

    // Close All DS Connections
    private closeAllDSConns() {
        let i = 0;
        while(i < this.allDriverStations.length) {
            this.closeDsConn(i);
            i++;
        }
    }

    // DriverStation Things to do on prestart
    public onPrestart(match: Match) {
        // Close all DS Connections before we overwrite them
        this.closeAllDSConns();
        // Init New DriverStation Objects
        for(const t in match.participants) { // run through list of match participants looking for a match
            const ds = new DSConn();
            ds.teamId = match.participants[t].teamKey;
            ds.allianceStation = match.participants[t].station;
            this.allDriverStations[t] = ds;
        }
        logger.info('Driver Station Prestart Completed');
    }

    // Construct a control packet for the Driver Station
    private constructControlPacket (ds: DSConn): Uint8Array {
        const packet: Uint8Array = new Uint8Array(22);
        const activeMatch = EmsFrcFms.getInstance().activeMatch;

        // Packet number, stored big-endian in two bytes.
        packet[0] = (ds.packetCount >> 8) & 0xff;
        packet[1] = ds.packetCount & 0xff;

        // Protocol version.
        packet[2] = 0;

        // Robot status byte.
        packet[3] = 0;
        if (ds.auto) {
            packet[3] |= 0x02
        }
        if (ds.enabled) {
            packet[3] |= 0x04
        }
        if (ds.estop) {
            packet[3] |= 0x80
        }

        // Unknown or unused.
        packet[4] = 0;

        // Alliance station.
        packet[5] = ds.allianceStation;

        // Match type
        const match = activeMatch.matchName;
        if (match.toLowerCase().indexOf("prac") > -1) {
            packet[6] = 1
        } else if (match.toLowerCase().indexOf("qual") > -1) {
            packet[6] = 2
        } else if (match.toLowerCase().indexOf("elim") > -1) {
            packet[6] = 3
        } else {
            packet[6] = 0
        }

        // Match number.
        const split = activeMatch.matchKey.split('-');
        const localMatchNum = parseInt(split[split.length-1].substr(1))
        if (match.toLowerCase().indexOf("practice") > -1 || match.toLowerCase().indexOf("qual") > -1) {
            packet[7] = localMatchNum >> 8;
            packet[8] = localMatchNum & 0xff;
        } else if (match.toLowerCase().indexOf("elim") > -1 ) {
            // E.g. Quarter-final 3, match 1 will be numbered 431. TODO: aaaaaaaaaaaa
            //matchNumber := match.ElimRound*100 + match.ElimGroup*10 + match.ElimInstance
            //packet[7] = matchNumber >> 8;
            //packet[8] = matchNumber & 0xff;
        } else {
            packet[7] = 0;
            packet[8] = 1;
        }
        // Match repeat number
        packet[9] = 1;

        // Current time.
        const currentTime = new Date(Date.now());
        const nanoSeconds = currentTime.getMilliseconds() * 1000000;
        packet[10] = ((nanoSeconds / 1000) >> 24) & 0xff;
        packet[11] = ((nanoSeconds / 1000) >> 16) & 0xff;
        packet[12] = ((nanoSeconds / 1000) >> 8) & 0xff;
        packet[13] = (nanoSeconds / 1000) & 0xff;
        packet[14] = currentTime.getSeconds();
        packet[15] = currentTime.getMinutes();
        packet[16] = currentTime.getHours();
        packet[17] = currentTime.getDay();
        packet[18] = currentTime.getMonth();
        packet[19] = currentTime.getFullYear() - 1900;

        // Remaining number of seconds in match.
        const matchSecondsRemaining = EmsFrcFms.getInstance().timeLeft;

        packet[20] = matchSecondsRemaining >> 8 & 0xff;
        packet[21] = matchSecondsRemaining & 0xff;

        // Increment the packet count for next time.
        ds.packetCount++;

        return packet;
    }

    // Decodes a Driver Station status packet
    private decodeStatusPacket(data: Buffer, dsNum: number) {
        // Average DS-robot trip time in milliseconds.
        this.allDriverStations[dsNum].dsRobotTripTimeMs = data[1] / 2;

        // Number of missed packets sent from the DS to the robot.
        this.allDriverStations[dsNum].missedPacketCount = data[2] - this.allDriverStations[dsNum].missedPacketOffset;
    }
}


export default DriverstationSupport.getInstance();