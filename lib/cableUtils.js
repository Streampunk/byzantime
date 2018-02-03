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

const crypto = require('crypto');
const uuid = require('uuid');

const ptpBase = x => (d => [ d / 1000 | 0, (d % 1000) * 1000000])(new Date(x));

const nineZeros = '000000000';

const formatPTP = ts => {
  let nanos = ts[1].toString();
  return `${ts[0]}:${nineZeros.slice(nanos.length)}${nanos}`;
};

const parsePTP = ts => {
  let match = ts.match(/(\d+):(\d+)/);
  return match ? [ +match[1], +match[2] ] : [ 0, 0 ];
};

const ptpIndex = (base, index, rate) => {
  let numerator = index * rate[1];
  let seconds = numerator / rate[0] | 0;
  let remainderSum =
    (((numerator % rate[0]) * 1000000000) / rate[0] | 0) + base[1];
  return [ base[0] + seconds + (remainderSum > 1000000000 ? 1 : 0),
    remainderSum % 1000000000 ];
};

/* const compareTs = (lm, rm) => {
  if (lm[0] < rm[0]) return -1;
  if (lm[0] > rm[0]) return 1;
  if (lm[1] < rm[1]) return -1;
  if (lm[1] > rm[1]) return 1;
  return 0;
}; */

const tsToMs = ts => ts[0] * 1000 + ts[1] / 1000000 | 0;

const fuzzyIndex = (base, ts, rate) => {
  if (typeof ts === 'string') ts = parsePTP(ts);
  let rateMs = rate[1] * 1000 / rate[0] | 0;
  let margin = rateMs / 10 | 0 + 1;
  return (tsToMs(ts) - tsToMs(base) + margin) / rateMs | 0;
};

function makeID (pkid, trkID = '') {
  let hash = crypto.createHash('sha1');
  hash.update(Buffer.from(uuid.parse(pkid)));
  hash.update(typeof trkID === 'number' ? 'TrackID' + trkID : trkID, 'utf8');
  let dig = hash.digest();
  // Make a legal V5 UUID identifier wrt rfc4122
  dig[6] = (dig[6] & 0x0f) | 0x50;
  dig[8] = (dig[8] & 0x3f) | 0x80;
  return uuid.unparse(dig);
}

function mapElement (el, ppID) {
  let baseTime = ptpBase(el.DescriptorCreationTime);
  return {
    flowID: makeID(ppID, el.TrackID),
    sourceID: makeID(el.SourcePackageID[1], el.TrackID),
    name: (el.TrackType === 'PictureEssenceTrack' ? 'video_' : 'audio_') + el.TrackID,
    tags: { // TODO fade this out - move to SMPTE descriptors only
      grainDuration: [
        el.EssenceDescription.SampleRate[1],
        el.EssenceDescription.SampleRate[0] ] },
    start: formatPTP(baseTime),
    baseTime: baseTime,
    description: el.EssenceDescription,
    indexRef: `${el.EssenceStreamID}-${el.EssenceTrackNumber}`
  };
}

function makeCable (baseCable) {
  return {
    id: baseCable.id,
    video: baseCable.video.map(el => mapElement(el, baseCable.id)),
    audio: baseCable.audio.map(el => mapElement(el, baseCable.id)),
    backPressure: baseCable.backPressure
  };
}

module.exports = { ptpBase, makeID, makeCable, formatPTP,
  parsePTP, ptpIndex, fuzzyIndex };
