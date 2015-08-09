/// <reference path="../../typings/app.d.ts" />
var minimist = require('minimist');
var path = require('path');
var immo_1 = require('./immo');
var commandArgs;
var immoOpts = {};
var basename = path.basename(process.argv[1]);
if (/^immo(.+?)$/.test(basename)) {
    // symlink execution
    // immoprog <args> == immo -- prog <args>
    commandArgs = [RegExp.$1].concat(process.argv.slice(2));
    try {
        immoOpts = require(path.resolve(process.cwd(), './.immo.conf.js'));
    }
    catch (_) {
    }
}
else {
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
        console.log("Usage: " + basename + " [-C <config file>] [-n <attempts>] [-t <timeout>] [-p <pattern>] [-q] [--] <command> <args...>");
        process.exit(1);
    }
    commandArgs = opts._;
    // -C, --config
    if ('config' in opts) {
        immoOpts = require(path.resolve('.', opts['config']));
    }
    // -n, --attempts
    if ('attempts' in opts) {
        immoOpts.maxAttempts = 0 + opts['attempts'];
    }
    // -t, --timeout
    if ('timeout' in opts) {
        immoOpts.timeoutSeconds = 0 + opts['timeout'];
    }
    // -p, --pattern
    if ('pattern' in opts) {
        var pattern = opts['pattern'];
        immoOpts.outputPatterns = (pattern instanceof Array ? pattern : [pattern])
            .map(function (p) { return new RegExp(p); });
    }
    // -q, --quiet
    if (!!opts['quiet']) {
        immoOpts.quiet = true;
    }
}
var immo = new immo_1.Immo(commandArgs, immoOpts);
immo.run().then(function (cmd) {
    process.stdout.write(cmd.out);
    process.stderr.write(cmd.err);
    process.exit(cmd.exitCode);
});
