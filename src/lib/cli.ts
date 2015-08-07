/// <reference path="../../typings/bundle.d.ts" />
// revenant [-C config.js] [-p <regexp>] [-c <max retry count>] [-t <timeout sec>] [--] command args...

import * as child_process from 'child_process'
import * as minimist      from 'minimist'

class Command {
  process: child_process.ChildProcess;

  command: string;
  args:    string[];

  out: string = '';
  err: string = '';

  exitCode: number;

  constructor(cmd: string[]) {
    this.command = cmd[0];
    this.args    = cmd.slice(1);
  }

  run(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.process = child_process.spawn(this.command, this.args);
      this.process.stdout.on('data', (data: string) => { this.out += data });
      this.process.stderr.on('data', (data: string) => { this.err += data });
      this.process.on('close', (exitCode: number) => {
        this.exitCode = exitCode;
        resolve();
      });
    });
  }
}

interface RevenantOpts {
  maxAttempts?: number;
  timeoutSeconds?: number;
  outputPatterns?: RegExp[];
  verbose?: boolean;
}

class Revenant implements RevenantOpts {
  // The command to invoke and retry on failure.
  commandArgs: string[];

  // Maximum number of retries.
  maxAttempts: number = 5;

  // If the process took longer than this duration, kill it and retry.
  timeoutSeconds: number = 0;

  // If set, retry only if the patterns are met to the stdout/stderr.
  outputPatterns: RegExp[] = [];

  verbose: boolean = false;

  attempts: number = 0;

  constructor (commandArgs: string[], opts?: RevenantOpts) {
    this.commandArgs = commandArgs;

    if (opts) {
      this.maxAttempts    = opts.maxAttempts;
      this.timeoutSeconds = opts.timeoutSeconds;
      this.outputPatterns = opts.outputPatterns;
      this.verbose        = opts.verbose;
    }

    this.maxAttempts = this.maxAttempts || 5;
  }

  run(): Promise<Command> {
    this.log('--> run ' + JSON.stringify(this.commandArgs));

    var next: () => Promise<Command> = () => {
      this.attempts++;

      var cmd = new Command(this.commandArgs);

      return cmd.run()
        .then(() => {
          if (cmd.exitCode === 0 || this.attempts >= this.maxAttempts) {
            return cmd;
          }

          this.log(`--> exit=${cmd.exitCode} attempts=${this.attempts}/${this.maxAttempts}`);
          this.log(cmd.out, { prefix: 'OUT ' });
          this.log(cmd.err, { prefix: 'ERR ' });

          return next();
        });
    }

    return next();
  }

  private log(data: string, opts?: { prefix?: string; }) {
    var lines = data.split(/\n/);
    if (lines[lines.length-1] === '') {
      lines.pop()
    }
    lines.forEach((line: string) => {
      if (opts && opts.prefix) {
        line = opts.prefix + line;
      }
      process.stderr.write(`# [${this.attempts}/${this.maxAttempts}] ${line}\n`);
    });
  }
}

var opts = minimist(process.argv.slice(2), { stopEarly: true, default: { re: [] } });

if (opts._.length === 0) {
  console.log(`Usage: ${process.argv[1]}`);
  process.exit(1);
}

var revOpts: RevenantOpts = {};

if ('c' in opts) {
  revOpts.maxAttempts = 0+opts['c'];
}

if ('t' in opts) {
  revOpts.timeoutSeconds = 0+opts['t'];
}

if ('p' in opts) {
  revOpts.outputPatterns = (opts['p'] instanceof Array ? opts['p'] : [ opts['p'] ])
    .map((p: string) => new RegExp(p));
}

var app = new Revenant(opts._, revOpts);
app.run().then((cmd: Command) => {
  process.stdout.write(cmd.out);
  process.stderr.write(cmd.err);
  process.exit(cmd.exitCode);
});
