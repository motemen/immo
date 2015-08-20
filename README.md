immo
====

Runs a command until it succeeds.

## Description

`immo` runs the specified command and re-runs it if it has failed (exit code != 0). If the command suceeds or the number of attempts reached the limit, `immo` exits with stdout, stderr and the exit code being those of the command.

## Usage

    immo [-C config.json] [-n count] [-t timeout] [-p pattern] [--] command args...

Options:

    --config,   -C <file>     Specify configuration file (see below)
    --attempts, -n <count>    Maximum number of attempts (default: 5)
    --timeout,  -t <seconds>  Timeout for each execution in seconds (default: no timeout)
    --pattern,  -p <pattern>  Retry execution only if one the regexp patterns was met, can be specified multiple times
    --quiet,    -q            Do not show the outputs of failed executions

## Configuration

```js
module.exports = {
  // Corresponds to --pattern
  outputPatterns: [
    /cannot open port: \d+/
  ],

  // Corresponds to --timeout
  timeoutSeconds: 2.5,

  // Corresponds to --attempts
  maxAttempts: 5,

  // Corresponds to --quiet
  quiet: false
};
```

Also consult the config.sample.js.

## Example

```
% immo -- node -e 'var dice = Math.floor(Math.random() * 6)+1; console.log("dice:", dice); if (dice !== 6) throw "boo!"'
# [0/5] --> run ["node","-e","var dice = Math.floor(Math.random() * 6)+1; console.log(\"dice:\", dice); if (dice !== 6) throw \"boo!\""]
# [1/5] --> exited with code 1
# [1/5] OUT dice: 3
# [1/5] ERR
# [1/5] ERR [eval]:1
# [1/5] ERR r(Math.random() * 6)+1; console.log("dice:", dice); if (dice !== 6) throw "boo
# [1/5] ERR                                                                     ^
# [1/5] ERR boo!
# [2/5] --> exited with code 1
# [2/5] OUT dice: 2
# [2/5] ERR
# [2/5] ERR [eval]:1
# [2/5] ERR r(Math.random() * 6)+1; console.log("dice:", dice); if (dice !== 6) throw "boo
# [2/5] ERR                                                                     ^
# [2/5] ERR boo!
# [3/5] --> command succeeded
dice: 6
% echo $?
0
```

## Author

motemen <motemen@gmail.com>
