import { ChildProcess } from 'child_process'
import { EventEmitter } from 'events';
import { v1 } from 'uuid'
import { IPCMessage } from './ipc-message';
import { Processes } from './processes';
export class IPC extends EventEmitter {

    private _processes: Processes = null;
    private static _actionRegister: { name: string, action: (payload: any) => any }[] = [];



    constructor(processes: Processes) {
        super();
        this._processes = processes;
        for (let p of Object.keys(this._processes)) {
            this._processes[p].on("message", (msg: IPCMessage) => {
                if (msg.destination === null) this.emit(msg.name, msg);
                if (msg.destination === "*")
                    Object.values(this._processes)
                        .forEach((o: ChildProcess) => o.send(msg));
                if (msg.destination === "#")
                    Object.values(this._processes)
                        .filter(o => o !== this._processes[p])
                        .forEach((o: ChildProcess) => o.send(msg));
                if (typeof this._processes[msg.destination] === 'object' && this._processes[msg.destination] !== null)
                    this._processes[msg.destination].send(msg);
            })
        }
    }

    public static Query<T>(destination: string, name: string, payload: any = {}): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let attempt = 0;
            let guid = v1();
            var int = setInterval(() => {
                attempt++;
                if (attempt > 100) {
                    clearInterval(int);
                    reject(new Error(`Timeout expired for message ${name} with id ${guid}`));
                    return;
                }
                process.send({ guid, payload, name, destination, source: process.env.name, direction: "req" } as IPCMessage, (e) => {
                    if (e) {
                        clearInterval(int);
                        reject(e);
                    }
                })
            }, 30);
            let callback = (data: IPCMessage) => {
                if (data.guid === guid && data.direction === "res") {
                    process.removeListener('message', callback);
                    resolve(data.payload);
                }
            }
            process.addListener("message", callback);
        });
    }

    public static send(destination: string, name: string, payload: any): Promise<void> {
        return new Promise((resolve, reject) => {
            process.send({ payload, name, destination, source: process.env.name } as IPCMessage, (e) => {
                if (e) reject(e);
                else resolve();
            });
        })
    }

    public static sendReady(payload: any = {}) {
        return this.send(null, "ready", payload);
    }

    public static defineMessage(name: string, action: (o: any) => any) {
        if (this._actionRegister.find(o => o.action === action) === undefined)
            this._actionRegister.push({ name, action });
    }

    public static start() {
        process.on("message", (msg: IPCMessage) => {
            let act = this._actionRegister.find(o => o.name === msg.name);
            if (act !== undefined) {
                let r = act.action(msg.payload);
                if (msg.destination !== null && msg.destination !== undefined && msg.direction === "req") {
                    process.send({
                        payload: r,
                        name: msg.name,
                        destination: msg.source,
                        source: process.env.name,
                        direction: "res",
                        guid: msg.guid
                    } as IPCMessage, (e) => { });
                }
            }
        });
    }
}