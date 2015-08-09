/// <reference path="../../typings/app.d.ts" />

import * as assign from 'lodash.assign';

import {Command} from './command';

export interface ImmoOpts {
  // Maximum number of retries.
  maxAttempts?:    number;

  // If the process took longer than this duration, kill it and retry.
  timeoutSeconds?: number;

  // If set, retry only if the patterns are met to the stdout/stderr.
  outputPatterns?: RegExp[];

  // If set, do not show the outputs of failed execution.
  quiet?:          boolean;
}

export class Immo {
  opts: ImmoOpts;

  private attempts: number = 0;

  static defaultOpts: ImmoOpts = {
    maxAttempts: 5,
    timeoutSeconds: 0,
    outputPatterns: null,
    quiet: false
  }

  constructor (public commandArgs: string[], opts?: ImmoOpts) {
    this.opts = assign(Immo.defaultOpts, opts);
  }

  run(): Promise<Command> {
    this.log('--> run ' + JSON.stringify(this.commandArgs));
    return this.next();
  }

  private next() {
    this.attempts++;

    var promises = [];

    var cmd = new Command(this.commandArgs);
    promises.push(cmd.run());

    if (this.opts.timeoutSeconds > 0) {
      var timeoutMillis = this.opts.timeoutSeconds * 1000;
      var timeout = new Promise<any>((resolve, reject) => {
        setTimeout(() => {
          // send SIGTERM
          // TODO: make configurable
          cmd.process.kill();
          reject(`timed out after ${timeoutMillis}ms`);
        }, timeoutMillis);
      });
      promises.push(timeout);
    }

    return Promise.race(promises).then((cmd) => {
      this.log('--> command succeeded');
      return cmd;
    }).catch((err) => {
      this.log(`--> ${err}`)

      // If exited normal way (i.e. no timeout), check the output
      // and if none matched, give up
      // TODO use err to determine if timed out or not
      if (cmd.exitCode !== null && !this.outputMatches(cmd)) {
        this.log('--> no pattern matched');
        return cmd;
      }

      if (this.attempts >= this.opts.maxAttempts) {
        this.log('--> giving up');
        return cmd;
      }

      this.log(cmd.out, { prefix: 'OUT ' });
      this.log(cmd.err, { prefix: 'ERR ' });

      return this.next();
    });
  }

  private outputMatches(cmd: Command): boolean {
    var patterns = this.opts.outputPatterns;
    if (!patterns || patterns.length === 0) {
      return true;
    }

    return patterns.some((re) => re.test(cmd.out) || re.test(cmd.err));
  }

  private log(data: string, opts?: { prefix?: string; }) {
    if (this.opts.quiet) return;

    var lines = data.split(/\n/);
    if (lines[lines.length-1] === '') {
      lines.pop()
    }
    lines.forEach((line: string) => {
      if (opts && opts.prefix) {
        line = opts.prefix + line;
      }
      process.stderr.write(`# [${this.attempts}/${this.opts.maxAttempts}] ${line}\n`);
    });
  }
}
