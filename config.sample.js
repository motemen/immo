module.exports = {
  // An array of RegExp's to test the outputs (stdouts and stderrs) of failed executions.
  // Immo tries to re-execute the command only if any of patterns are met.
  // If not set or empty, it retries on every failed execution. (Until maxAttempts)
  outputPatterns: [
    /cannot open port: \d+/
  ],

  // Immo kills the command after this time passed.
  // If not set, command is run with no timeout.
  timeoutSeconds: 2.5,

  // Immo tries to execute the command up to this count.
  maxAttempts: 5,

  // Do not show the outputs of failed executions.
  quiet: false
};
