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
    Command.prototype.run = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.process = child_process.spawn(_this.command, _this.args);
            _this.process.stdout.on('data', function (data) { _this.out += data; });
            _this.process.stderr.on('data', function (data) { _this.err += data; });
            _this.process.on('close', function (exitCode) {
                _this.exitCode = exitCode;
                if (exitCode === 0) {
                    resolve();
                }
                else {
                    reject("exited with code " + exitCode);
                }
            });
        });
    };
    return Command;
})();
var Revenant = (function () {
    function Revenant(commandArgs, opts) {
        // Maximum number of retries.
        this.maxAttempts = 5;
        // If the process took longer than this duration, kill it and retry.
        this.timeoutSeconds = 0;
        // If set, retry only if the patterns are met to the stdout/stderr.
        this.outputPatterns = [];
        this.verbose = false;
        this.attempts = 0;
        this.commandArgs = commandArgs;
        if (opts) {
            this.maxAttempts = opts.maxAttempts;
            this.timeoutSeconds = opts.timeoutSeconds;
            this.outputPatterns = opts.outputPatterns;
            this.verbose = opts.verbose;
        }
        this.maxAttempts = this.maxAttempts || 5;
    }
    Revenant.prototype.run = function () {
        var _this = this;
        this.log('--> run ' + JSON.stringify(this.commandArgs));
        var next = function () {
            _this.attempts++;
            var cmd = new Command(_this.commandArgs);
            var timeout = new Promise(function (resolve, reject) {
                if (_this.timeoutSeconds > 0) {
                    var timeoutMillis = _this.timeoutSeconds * 1000;
                    setTimeout(function () {
                        cmd.process.kill();
                        reject("timed out after " + timeoutMillis + "ms");
                    }, timeoutMillis);
                }
            });
            return Promise.race([cmd.run(), timeout])
                .then(function () {
                return cmd;
            }, function (err) {
                _this.log("--> " + err);
                if (_this.attempts >= _this.maxAttempts) {
                    return cmd;
                }
                _this.log(cmd.out, { prefix: 'OUT ' });
                _this.log(cmd.err, { prefix: 'ERR ' });
                return next();
            });
        };
        return next();
    };
    Revenant.prototype.log = function (data, opts) {
        var _this = this;
        var lines = data.split(/\n/);
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }
        lines.forEach(function (line) {
            if (opts && opts.prefix) {
                line = opts.prefix + line;
            }
            process.stderr.write("# [" + _this.attempts + "/" + _this.maxAttempts + "] " + line + "\n");
        });
    };
    return Revenant;
})();
var opts = minimist(process.argv.slice(2), { stopEarly: true, default: { re: [] } });
if (opts._.length === 0) {
    console.log("Usage: " + process.argv[1]);
    process.exit(1);
}
var revOpts = {};
if ('c' in opts) {
    revOpts.maxAttempts = 0 + opts['c'];
}
if ('t' in opts) {
    revOpts.timeoutSeconds = 0 + opts['t'];
}
if ('p' in opts) {
    revOpts.outputPatterns = (opts['p'] instanceof Array ? opts['p'] : [opts['p']])
        .map(function (p) { return new RegExp(p); });
}
var app = new Revenant(opts._, revOpts);
app.run().then(function (cmd) {
    process.stdout.write(cmd.out);
    process.stderr.write(cmd.err);
    process.exit(cmd.exitCode);
});
