/* Copyright 2018 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const test = require('tape');
const H = require('highland');
const elementPipe = require('../scratch/elementPipe.js');

const a = [];

for ( let x = 0 ; x < 2048 ; x++ ) {
  a.push(x);
}

const b = Buffer.from(a);

const c = [];

for ( let x = 0 ; x < 2048 ; x += 100) {
  c.push(b.slice(x, x + 100));
}

test('Small short single element', t => {
  H(c)
    .through(elementPipe(10, [{ start: 12, end: 16 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      t.deepEqual(a, [ Buffer.from([2, 3, 4, 5, 6]) ], 'produces expected element.');
      t.end();
    });
});

test('Single element overlapping one boundary', t => {
  H(c)
    .through(elementPipe(10, [{ start: 20, end: 120 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      t.equal(a.length, 2, 'produces an array length 2.');
      t.deepEqual(a.map(x => x.length), [90, 11],
        'buffers are of expected length.');
      t.equal(a[0][0], 10, 'first buffer starts with 10.');
      t.equal(a[0][a[0].length - 1], 99, 'first buffer ends with 99.');
      t.equal(a[1][0], 100, 'second buffer starts with 100.');
      t.equal(a[1][a[1].length - 1], 110, 'second buffer ends with 110.');
      t.end();
    });
});

test('Single element overlapping lots of boundaries', t => {
  H(c)
    .through(elementPipe(10, [{ start: 20, end: 1020 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      t.equal(a.length, 11, 'produces an array length 11.');
      t.deepEqual(
        a.map(x => x.length),
        [90, 100, 100, 100, 100, 100, 100, 100, 100, 100, 11],
        'buffers are of expected length.');
      t.equal(a[0][0], 10, 'first buffer starts with 10.');
      t.equal(a[0][a[0].length - 1], 99, 'first buffer ends with 99.');
      t.equal(a[10][0], 1000 % 256, 'second buffer starts with 1000 % 256.');
      t.equal(a[10][a[10].length - 1], 1010 % 256, 'second buffer ends with 1010 % 256.');
      t.end();
    });
});

test('Single element longer than the stream', t => {
  H(c)
    .through(elementPipe(10, [{ start: 2000, end: 2500 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      let lastEl = a[a.length - 1];
      t.equal(lastEl[lastEl.length - 1], 0xff, 'last element of the buffer is 0xff.');
      t.ok(a.reduce((x, y) => x + y.length, 0) < 501,
        'produces significantly less values.');
      t.end();
    });
});

test('Single element beyond than the stream', t => {
  H(c)
    .through(elementPipe(10, [{ start: 2100, end: 2500 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      t.equal(a.length, 0, 'produces nothing.');
      t.end();
    });
});

test('Single element starting a few buffers in', t => {
  H(c)
    .through(elementPipe(10, [{ start: 350, end: 525 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      t.equal(a.length, 3, 'creates three buffer.');
      t.equal(a.reduce((x, y) => x + y.length, 0), 176, 'has combined values of 176.');
      t.equal(a[0][0], (350-10) % 256, 'starts with the expected value.');
      t.equal(a[2].slice(-1)[0], (525-10) % 256, 'last entry has expected value.');
      t.end();
    });
});

const expectedLengths = [2, 2, 1, 1];
for ( let s = 0 ; s < 4 ; s++ ) {
  test('Single element start crossing the bounbary', t => {
    H(c)
      .through(elementPipe(10, [{ start: s + 108, end : 120 }]))
      .errors(e => { t.fail(e); })
      .toArray(a => {
        console.log(a);
        t.equal(a.length, expectedLengths[s],
          'number of buffers reduces as expected.');
        t.equal(Buffer.concat(a).length, 13 - s,
          'number of elements decreases from 13 to 10.');
        t.equal(Buffer.concat(a).slice(-1)[0], (120-10)%256,
          'last element is the same.');
        if (a.length === 2) {
          t.ok(a[0].slice(-1)[0] === a[1][0] - 1, 'buffer values are contiguous.');
        }
        t.end();
      });
  });
}

for ( let s = 0 ; s < 4 ; s++ ) {
  test('Single element end crossing the bounbary', t => {
    H(c)
      .through(elementPipe(10, [{ start: 100, end : 108 + s }]))
      .errors(e => { t.fail(e); })
      .toArray(a => {
        // console.log(a);
        t.equal(a.length, expectedLengths[3 - s],
          'number of buffers increases as expected.');
        t.equal(Buffer.concat(a).length, 9 + s,
          'number of elements increases from 9 to 12.');
        t.equal(Buffer.concat(a).slice(-1)[0], 98 + s,
          'last element is the same.');
        if (a.length === 2) {
          t.ok(a[0].slice(-1)[0] === a[1][0] - 1, 'buffer values are contiguous.');
        }
        t.end();
      });
  });
}
