/// <reference path="../typings/app.d.ts" />

import * as nexpect from 'nexpect';
import * as chai    from 'chai';
import * as path    from 'path';

var assert = chai.assert;

var immoPath = path.resolve(__dirname, '../bin/immo');

describe('immo', () => {
  it('does not retry on successful execution', (done) => {
    nexpect.spawn(
      'node', [ immoPath, '--', 'node', '-e', 'process.exit(0)' ], { stream: 'stderr' }
    ).run((err, output, exit) => {
      assert(!err);
      assert(exit === 0);
      done();
    });
  });

  it('retries up to maxAttempts on unsuccessful execution', (done) => {
    nexpect.spawn(
      'node', [ immoPath, '-n', '5', '--', 'node', '-e', 'process.exit(1)' ], { stream: 'stderr' }
    ).run((err, output, exit) => {
      assert(!err);
      assert(exit === 1);
      assert(output.filter((line) => /exited with code 1/.test(line)).length === 5);
      done();
    });
  });
});
