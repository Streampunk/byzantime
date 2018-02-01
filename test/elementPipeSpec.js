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
const elementPipe = require('../lib/elementPipe.js');

const a = [];

for ( let x = 0 ; x < 2048 ; x++ ) {
  a.push(x);
}

const b = Buffer.from(a);

const c = [];

for ( let x = 0 ; x < 2048 ; x += 100) {
  c.push(b.slice(x, x + 100));
}

function arrayOfBuffers (a, t) {
  t.ok(a.every(b => Buffer.isBuffer(b)), 'every array element is a buffer.');
}

test('Small short single element', t => {
  H(c)
    .through(elementPipe(10, [{ start: 12, end: 16 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      arrayOfBuffers(a, t);
      t.deepEqual(a, [ Buffer.from([2, 3, 4, 5, 6]) ], 'produces expected element.');
      t.end();
    });
});

test('Single element overlapping one boundary', t => {
  H(c)
    .through(elementPipe(10, [{ start: 20, end: 120 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      arrayOfBuffers(a, t);
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
      arrayOfBuffers(a, t);
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
      arrayOfBuffers(a, t);
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
      arrayOfBuffers(a, t);
      t.equal(a.length, 0, 'produces nothing.');
      t.end();
    });
});

test('Single element starting a few buffers in', t => {
  H(c)
    .through(elementPipe(10, [{ start: 350, end: 525 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      arrayOfBuffers(a, t);
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
        arrayOfBuffers(a, t);
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
        arrayOfBuffers(a, t);
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

function isContiguous (b) {
  if (b.length <= 1) return true;
  for ( let x = 1 ; x < b.length ; x++ ) {
    if (b[x] === 0) {
      if (b[x - 1] !== 255)
        return false;
      continue;
    }
    if (b[x - 1] !== (b[x] - 1))
      return false;
  }
  return true;
}

test('Three elements of various lengths', t => {
  H(c)
    .through(elementPipe(10, [
      { start: 20, end: 30 },
      { start: 105, end: 115 },
      { start: 175, end: 375 }
    ]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      arrayOfBuffers(a, t);
      t.deepEqual(a.map(x => x.length), [11, 5, 6, 35, 100, 66],
        'lengths of arrays are as expected.');
      let firstElement = a[0];
      t.equal(firstElement[0], (20-10)%256,
        'first element starts as expected.');
      t.equal(firstElement.slice(-1)[0], (30-10)%256,
        'first element ends as expected.');
      t.ok(isContiguous(firstElement), 'first element is contiguous.');
      let secondElement = Buffer.concat(a.slice(1, 3));
      t.equal(secondElement[0], (105-10)%256,
        'second element starts as expected.');
      t.equal(secondElement.slice(-1)[0], (115-10)%256,
        'second element ends as expected.');
      t.ok(isContiguous(secondElement), 'second element is contigous.');
      let thirdElement = Buffer.concat(a.slice(3));
      t.equal(thirdElement[0], (175-10)%256,
        'third element starts as expected.');
      t.equal(thirdElement.slice(-1)[0], (375-10)%256,
        'thrid element ends as expected.');
      t.ok(isContiguous(thirdElement), 'third element is contiguous.');
      t.end();
    });
});

test('Element is complete block', t => {
  H(c)
    .through(elementPipe(0, [ { start: 0, end: 2047 }]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      arrayOfBuffers(a, t);
      t.deepEqual(a, c, 'input and output arrays are the same.');
      t.ok(isContiguous(Buffer.concat(a)), 'values are continguous.');
      t.end();
    });
});

test('No elements in list', t => {
  H(c)
    .through(elementPipe(0, []))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      arrayOfBuffers(a, t);
      t.ok(Array.isArray(a) && a.length === 0, 'produces nothing.');
      t.end();
    });
});

test('Handles ranges of zero and one byte', t => {
  H(c)
    .through(elementPipe(10, [
      { start: 12, end: 12 },
      { start: 42, end: 41 }
    ]))
    .errors(e => { t.fail(e); })
    .toArray(a => {
      arrayOfBuffers(a, t);
      t.deepEqual(a, [ Buffer.from([0x02]), Buffer.from([]) ],
        'produces the expected buffers.');
      t.end();
    });
});

test('Testing start range errors', t => {
  t.throws(() => elementPipe(-10, []), /RangeError/,
    'throws for negative position');
  t.throws(() => elementPipe(10, [ { start: 9, end: 12 }]), /RangeError/,
    'throws for start before position.');
  t.throws(() => elementPipe(10, [ { start: 12, end: 9 }]), /RangeError/,
    'throws for end before position.');
  t.throws(() => elementPipe(10, [
    { start: 12, end: 42 },
    { start: 40, end: 77 }]
  ), /RangeError/, 'throws for overlapping ranges.');
  t.doesNotThrow(() => elementPipe(10, [ { start: 12, end: 12 }]), /RangeError/,
    'does not throw for start and end the same.');
  t.throws(() => elementPipe(10, [ { start: 12, end: 10 }]), /RangeError/,
    'throws for end before start.');
  t.end();
});
