/// <reference path="../../typings/app.d.ts" />
var assign = require('lodash.assign');
var command_1 = require('./command');
var Immo = (function () {
    function Immo(commandArgs, opts) {
        this.commandArgs = commandArgs;
        this.attempts = 0;
        this.opts = assign(Immo.defaultOpts, opts);
    }
    Immo.prototype.run = function () {
        this.log('--> run ' + JSON.stringify(this.commandArgs));
        return this.next();
    };
    Immo.prototype.next = function () {
        var _this = this;
        this.attempts++;
        var promises = [];
        var cmd = new command_1.Command(this.commandArgs);
        promises.push(cmd.run());
        if (this.opts.timeoutSeconds > 0) {
            var timeoutMillis = this.opts.timeoutSeconds * 1000;
            var timeout = new Promise(function (resolve, reject) {
                setTimeout(function () {
                    // send SIGTERM
                    // TODO: make configurable
                    cmd.process.kill();
                    reject("timed out after " + timeoutMillis + "ms");
                }, timeoutMillis);
            });
            promises.push(timeout);
        }
        return Promise.race(promises).then(function (cmd) {
            _this.log('--> command succeeded');
            return cmd;
        }).catch(function (err) {
            _this.log("--> " + err);
            // If exited normal way (i.e. no timeout), check the output
            // and if none matched, give up
            // TODO use err to determine if timed out or not
            if (cmd.exitCode !== null && !_this.outputMatches(cmd)) {
                _this.log('--> no pattern matched');
                return cmd;
            }
            if (_this.attempts >= _this.opts.maxAttempts) {
                _this.log('--> giving up');
                return cmd;
            }
            _this.log(cmd.out, { prefix: 'OUT ' });
            _this.log(cmd.err, { prefix: 'ERR ' });
            return _this.next();
        });
    };
    Immo.prototype.outputMatches = function (cmd) {
        var patterns = this.opts.outputPatterns;
        if (!patterns || patterns.length === 0) {
            return true;
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
    Immo.defaultOpts = {
        maxAttempts: 5,
        timeoutSeconds: 0,
        outputPatterns: null,
        quiet: false
    };
    return Immo;
})();
exports.Immo = Immo;
