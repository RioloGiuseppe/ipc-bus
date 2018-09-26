import { ChildProcess } from "child_process";

export interface IPCMessage {
    source: string;
    destination: string;
    name: string;
    guid: string
    payload: any
    direction: string
}

export interface Processes {
    [k: string]: ChildProcess;
}