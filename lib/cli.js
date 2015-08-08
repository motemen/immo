/// <reference path="../../typings/bundle.d.ts" />
// immo [-C config.js] [-p <regexp>] [-c <max retry count>] [-t <timeout sec>] [--] command args...
var child_process = require('child_process');
var minimist = require('minimist');
var assign = require('lodash.assign');
var Command = (function () {
    function Command(cmd) {
        this.out = '';
        this.err = '';
        this.exitCode = null;
        this.command = cmd[0];
        this.args = cmd.slice(1);
    }
    Command.prototype.run = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.process = child_process.spawn(_this.command, _this.args);
            _this.process.stdout.on('data', function (data) { _this.out += data; });
            _this.process.stderr.on('data', function (data) { _this.err += data; });
            _this.process.on('close', function (exitCode, signal) {
                _this.exitCode = exitCode;
                if (exitCode === 0) {
                    resolve(_this);
                }
                else {
                    reject("exited with code " + exitCode);
                }
            });
            _this.process.on('error', function (err) {
                reject(err);
            });
        });
    };
    return Command;
})();
var Immo = (function () {
    function Immo(commandArgs, opts) {
        this.commandArgs = commandArgs;
        this.attempts = 0;
        this.opts = assign({
            maxAttempts: 5,
            timeoutSeconds: 0,
            outputPatterns: [],
            quiet: false
        }, opts);
    }
    Immo.prototype.run = function () {
        var _this = this;
        this.log('--> run ' + JSON.stringify(this.commandArgs));
        var next = function () {
            _this.attempts++;
            var cmd = new Command(_this.commandArgs);
            var timeout = new Promise(function (resolve, reject) {
                if (!(_this.opts.timeoutSeconds > 0))
                    return;
                var timeoutMillis = _this.opts.timeoutSeconds * 1000;
                setTimeout(function () {
                    cmd.process.kill();
                    reject("timed out after " + timeoutMillis + "ms");
                }, timeoutMillis);
            });
            return Promise.race([cmd.run(), timeout]).catch(function (err) {
                _this.log("--> " + err);
                // If exited normal way (i.e. no timeout), check the output
                // and if none matched, give up
                // TODO use err to determine if timed out or not
                if (cmd.exitCode !== null && !_this.outputMatches(cmd)) {
                    _this.log("--> no pattern matched");
                    return cmd;
                }
                if (_this.attempts >= _this.opts.maxAttempts) {
                    _this.log("--> giving up");
                    return cmd;
                }
                _this.log(cmd.out, { prefix: 'OUT ' });
                _this.log(cmd.err, { prefix: 'ERR ' });
                return next();
            });
        };
        return next();
    };
    Immo.prototype.outputMatches = function (cmd) {
        var patterns = this.opts.outputPatterns;
        if (!patterns || patterns.length === 0) {
            patterns = [/(?:)/];
        }
        return patterns.some(function (re) { return re.test(cmd.out) || re.test(cmd.err); });
    };
    Immo.prototype.log = function (data, opts) {
        var _this = this;
        if (this.opts.quiet)
            return;
        var lines = data.split(/\n/);
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }
        lines.forEach(function (line) {
            if (opts && opts.prefix) {
                line = opts.prefix + line;
            }
            process.stderr.write("# [" + _this.attempts + "/" + _this.opts.maxAttempts + "] " + line + "\n");
        });
    };
    return Immo;
})();
var opts = minimist(process.argv.slice(2), {
    stopEarly: true,
    string: ['pattern'],
    boolean: ['quiet'],
    alias: {
        attempts: ['n'],
        timeout: ['t'],
        pattern: ['p'],
        quiet: ['q'],
        config: ['C']
    }
});
if (opts._.length === 0) {
    console.log("Usage: " + process.argv[1]);
    process.exit(1);
}
var revOpts = {};
// -n, --attempts
if ('attempts' in opts) {
    revOpts.maxAttempts = 0 + opts['attempts'];
}
// -t, --timeout
if ('timeout' in opts) {
    revOpts.timeoutSeconds = 0 + opts['timeout'];
}
// -p, --pattern
if ('pattern' in opts) {
    var pattern = opts['pattern'];
    revOpts.outputPatterns = (pattern instanceof Array ? pattern : [pattern])
        .map(function (p) { return new RegExp(p); });
}
// -q, --quiet
if (!!opts['quiet']) {
    revOpts.quiet = true;
}
var app = new Immo(opts._, revOpts);
app.run().then(function (cmd) {
    process.stdout.write(cmd.out);
    process.stderr.write(cmd.err);
    process.exit(cmd.exitCode);
});
