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

interface RevenantOpts {
  maxAttempts?:    number;
  timeoutSeconds?: number;
  outputPatterns?: RegExp[];
  verbose?:        boolean;
  quiet?:          boolean;
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
  quiet: boolean = false;

  private attempts: number = 0;

  constructor (commandArgs: string[], opts?: RevenantOpts) {
    this.commandArgs = commandArgs;

    if (opts) {
      this.maxAttempts    = opts.maxAttempts || 5;
      this.timeoutSeconds = opts.timeoutSeconds;
      this.outputPatterns = opts.outputPatterns || [];
      this.verbose        = opts.verbose;
      this.quiet          = opts.quiet;
    }

    this.maxAttempts = this.maxAttempts || 5;
  }

  run(): Promise<Command> {
    this.logVerbose('run ' + JSON.stringify(this.commandArgs));

    var next: () => Promise<Command> = () => {
      this.attempts++;

      var cmd = new Command(this.commandArgs);

      var timeout = new Promise<any>((resolve, reject) => {
        if (!(this.timeoutSeconds > 0)) return;

        var timeoutMillis = this.timeoutSeconds * 1000;
        setTimeout(() => {
          cmd.process.kill();
          reject(`timed out after ${timeoutMillis}ms`);
        }, timeoutMillis);
      });

      return Promise.race([ cmd.run(), timeout ]).catch((err) => {
        this.log(`--> ${err}`)

        // If exited normal way (i.e. no timeout), check the output
        // and if none matched, give up
        // TODO use err to determine if timed out or not
        if (cmd.exitCode !== null && !this.outputMatches(cmd)) {
          this.log(`--> no pattern matched`);
          return cmd;
        }

        if (this.attempts >= this.maxAttempts) {
          this.log(`--> giving up`);
          return cmd;
        }

        this.log(cmd.out, { prefix: 'OUT ' });
        this.log(cmd.err, { prefix: 'ERR ' });

        return next();
      });
    }

    return next();
  }

  private outputMatches(cmd: Command): boolean {
    var patterns = this.outputPatterns;
    if (!patterns || patterns.length === 0) {
      patterns = [ /(?:)/ ];
    }

    return patterns.some((re) => re.test(cmd.out) || re.test(cmd.err));
  }

  private log(data: string, opts?: { prefix?: string; }) {
    if (this.quiet) return;

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

  private logVerbose(log: string) {
    if (!this.verbose) return;

    this.log(log, { prefix: '--> ' });
  }
}

var opts = minimist(
  process.argv.slice(2), {
    stopEarly: true,
    string: ['pattern'],
    boolean: ['verbose', 'quiet'],
    alias: {
      attempts: ['n'],
      timeout:  ['t'],
      pattern:  ['p'],
      verbose:  ['v'],
      quiet:    ['q'],
      config:   ['C']
    }
});

if (opts._.length === 0) {
  console.log(`Usage: ${process.argv[1]}`);
  process.exit(1);
}

var revOpts: RevenantOpts = {};

// -n, --attempts
if ('attempts' in opts) {
  revOpts.maxAttempts = 0+opts['attempts'];
}

// -t, --timeout
if ('timeout' in opts) {
  revOpts.timeoutSeconds = 0+opts['timeout'];
}

// -p, --pattern
if ('pattern' in opts) {
  var pattern = opts['pattern'];
  revOpts.outputPatterns = (pattern instanceof Array ? pattern : [ pattern ])
    .map((p: string) => new RegExp(p));
}

// -v, --verbose
if (!!opts['verbose']) {
  revOpts.verbose = true;
  revOpts.quiet   = false;
}

// -q, --quiet
if (!!opts['quiet']) {
  revOpts.verbose = false;
  revOpts.quiet   = true;
}

var app = new Revenant(opts._, revOpts);
app.run().then((cmd: Command) => {
  process.stdout.write(cmd.out);
  process.stderr.write(cmd.err);
  process.exit(cmd.exitCode);
});
