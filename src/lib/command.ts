/// <reference path="../../typings/app.d.ts" />

import * as child_process from 'child_process'

export class Command {
  command: string;
  args:    string[];

  process: child_process.ChildProcess;

  out: string = '';
  err: string = '';
  exitCode: number = null;

  constructor(cmd: string[]) {
    this.command = cmd[0];
    this.args    = cmd.slice(1);
  }

  run(): Promise<Command> {
    return new Promise<Command>((resolve, reject) => {
      this.process = child_process.spawn(this.command, this.args);

      this.process.stdout.on('data', (data: string) => { this.out += data });
      this.process.stderr.on('data', (data: string) => { this.err += data });

      this.process.on('close', (exitCode: number, signal: string) => {
        this.exitCode = exitCode;

        if (exitCode === 0) {
          resolve(this);
        } else {
          reject(`exited with code ${exitCode}`);
        }
      });

      this.process.on('error', (err: Error) => {
        reject(err);
      });
    });
  }
}
