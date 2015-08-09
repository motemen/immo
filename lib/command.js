/// <reference path="../../typings/app.d.ts" />
var child_process = require('child_process');
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
exports.Command = Command;
