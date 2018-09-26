import { fork, ForkOptions } from 'child_process'
import { resolve } from 'path'
import { IPC } from './ipc';
import { Processes } from './ipc-message';


export class Runner {
    private _processes: Processes = null;
    private _ipc: IPC = null;
    private _debug: boolean = true;

    constructor() {
        let debug = true;
        this._processes = {
            manager: null,
            endpoints: null
        }
        this.forkManager(false);
        this.forkEndpoint(true);
        this._ipc = new IPC(this._processes);
        this._processes.manager.on("exit", (code: null, signal: string) => this.forkManager(debug));
        this._ipc.on("restart", () => {
            this._processes.manager.kill("SIGINT");
        });
        this._ipc.on("debug", (debug) => {
            if (debug !== this._debug) {
                this._debug = debug;
                this._processes.manager.kill("SIGINT");
            }
        });
    }

    private forkManager(debug: boolean = false): void {
        let fo: ForkOptions = { env: { name: "manager" } };
        if (debug)
            fo.execArgv = ['--inspect-brk=9223'];
        this._processes.manager = fork(resolve('./build/manager/index.js'), [], fo);
        this._processes.manager.on("exit", (code, signal) =>
            setTimeout(() =>
                this.forkManager, 1000));
    }


    private forkEndpoint(debug: boolean = false): void {
        let fo: ForkOptions = { env: { name: "endpoints" } };
        if (debug)
            fo.execArgv = ['--inspect-brk=9224'];
        this._processes.endpoints = fork(resolve('./build/endpoints/index.js'), [], fo);
        this._processes.endpoints.on("exit", (code, signal) =>
            setTimeout(() =>
                this.forkEndpoint, 1000));
    }

}