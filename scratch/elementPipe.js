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

const H = require('highland');

module.exports = function (position, elements) {
  if (typeof position !== 'number' || position < 0) {
    throw new RangeError('Starting position must be a number and less than zero.');
  }
  if (elements.some(el => el.start < position || el.end < position)) {
    throw new RangeError('All elements must be beyond the start position.');
  }
  if (elements.some(el => el.end - el.start < -1))
    throw new RangeError('All elements must have an end value beyond the start.');
  for ( let x = 1 ; x < elements.length ; x++ ) {
    if (elements[x - 1].end >= elements[x].start)
      throw new RangeError('All elements must be ordered and non-overlapping.');
  }
  let blobs = elements.map(el => ({
    start: el.start - position,
    end: el.end - position
  }));
  let blob = blobs.shift();
  let bufs = [];
  position = 0;
  let resetBufs = () => { let tmpBufs = bufs; bufs = []; return tmpBufs; };
  let pipeSplit = x => {
    if (!blob) return H(resetBufs());
    if (position < blob.start) {
      if (position + x.length <= blob.start) {
        position += x.length;
        return H(resetBufs());
      } else {
        let throwAway = blob.start - position;
        x = x.slice(throwAway);
        position = blob.start;
      }
    }
    if (position + x.length <= blob.end) {
      position += x.length;
      bufs.push(x);
      return H(resetBufs());
    } else {
      let blobstart = blob.end - position + 1;
      bufs.push(x.slice(0, blobstart));
      position = blob.end + 1;
      blob = blobs.shift();
      return pipeSplit(x.slice(blobstart));
    }
  };
  return H.pipeline(H.flatMap(pipeSplit));
};
