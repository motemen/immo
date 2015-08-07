/// <reference path="../../typings/bundle.d.ts" />
// revenant [-C config.js] [-p <regexp>] [-c <max retry count>] [-t <timeout sec>] [--] command args...
var child_process = require('child_process');
var minimist = require('minimist');
var Command = (function () {
    function Command(cmd) {
        this.out = '';
        this.err = '';
        this.command = cmd[0];
        this.args = cmd.slice(1);
    }
    Command.prototype.run = function (cb) {
        var _this = this;
        var p = this.process = child_process.spawn(this.command, this.args);
        p.stdout.on('data', function (data) { _this.out += data; });
        p.stderr.on('data', function (data) { _this.err += data; });
        p.on('close', function (code) { return cb(code); });
    };
    return Command;
})();
var opts = minimist(process.argv.slice(2), { stopEarly: true, default: { re: [] } });
if (opts._.length === 0) {
    console.log("Usage: " + process.argv[1]);
    process.exit(1);
}
_log('--> run ' + JSON.stringify(opts._));
var maxRetries = 0 + opts['c'] || 5;
var timeout = 0 + opts['t'];
var patterns = (opts['p'] instanceof Array ? opts['p'] : [opts['p']]).map(function (p) { return new RegExp(p); });
function retry1(args, remains) {
    var cmd = new Command(args);
    var timer;
    cmd.run(function (exitCode) {
        clearTimeout(timer);
        var finish = false;
        if (exitCode === 0 || remains <= 0) {
            finish = true;
        }
        if (patterns.length) {
            if (patterns.every(function (p) { return !p.exec(cmd.out) && !p.exec(cmd.err); })) {
                // if -p was given and none matched, give up.
                finish = true;
            }
        }
        if (finish) {
            process.stdout.write(cmd.out);
            process.stderr.write(cmd.err);
            process.exit(exitCode);
        }
        _log("--> exit=" + exitCode + " remains=" + remains + "/" + maxRetries);
        _log(cmd.out, { prefix: 'OUT' });
        _log(cmd.err, { prefix: 'ERR' });
        retry1(args, remains - 1);
    });
    if (timeout > 0) {
        timer = setTimeout(function () {
            _log("--> timed out after " + timeout * 1000 + "ms");
            cmd.process.kill();
        }, timeout * 1000);
    }
}
retry1(opts._, maxRetries);
function _log(data, opts) {
    var lines = data.split(/\n/);
    if (lines[lines.length - 1] === '') {
        lines.pop();
    }
    lines.forEach(function (line) {
        if (opts && opts.prefix) {
            line = opts.prefix + " " + line;
        }
        process.stderr.write("# [revenant] " + line + "\n");
    });
}
