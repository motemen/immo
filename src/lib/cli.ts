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

  constructor(cmd: string[]) {
    this.command = cmd[0];
    this.args    = cmd.slice(1);
  }

  run(cb: (number) => void) {
    var p = this.process = child_process.spawn(this.command, this.args);
    p.stdout.on('data', (data) => { this.out += data });
    p.stderr.on('data', (data) => { this.err += data });
    p.on('close', (code: number) => cb(code));
  }
}

var opts = minimist(process.argv.slice(2), { stopEarly: true, default: { re: [] } });

if (opts._.length === 0) {
  console.log(`Usage: ${process.argv[1]}`);
  process.exit(1);
}

_log('--> run ' + JSON.stringify(opts._))

var maxRetries: number   = 0+opts['c'] || 5;
var timeout   : number   = 0+opts['t'];
var patterns  : RegExp[] = (opts['p'] instanceof Array ? opts['p'] : [ opts['p'] ]).map((p) => new RegExp(p));

function retry1(args: string[], remains: number) {
  var cmd = new Command(args);

  var timer: NodeJS.Timer;

  cmd.run((exitCode: number) => {
    clearTimeout(timer);

    var finish: boolean = false;

    if (exitCode === 0 || remains <= 0) {
      finish = true;
    }

    if (patterns.length) {
      if (patterns.every((p) => !p.exec(cmd.out) && !p.exec(cmd.err))) {
        // if -p was given and none matched, give up.
        finish = true
      }
    }

    if (finish) {
      process.stdout.write(cmd.out);
      process.stderr.write(cmd.err);
      process.exit(exitCode);
    }

    _log(`--> exit=${exitCode} remains=${remains}/${maxRetries}`);
    _log(cmd.out, { prefix: 'OUT' });
    _log(cmd.err, { prefix: 'ERR' });

    retry1(args, remains-1);
  });

  if (timeout > 0) {
    timer = setTimeout(function () {
      _log(`--> timed out after ${timeout * 1000}ms`);
      cmd.process.kill();
    }, timeout * 1000);
  }
}

retry1(opts._, maxRetries);

function _log(data: string, opts?: { prefix: string; }) {
  var lines = data.split(/\n/);
  if (lines[lines.length-1] === '') {
    lines.pop()
  }
  lines.forEach((line: string) => {
    if (opts && opts.prefix) {
      line = `${opts.prefix} ${line}`
    }
    process.stderr.write(`# [revenant] ${line}\n`);
  });
}
