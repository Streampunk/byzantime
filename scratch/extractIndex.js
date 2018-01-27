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

const {
  kelviniser,
  metatiser,
  stripTheFiller,
  detailing,
  puppeteer
} = require('kelvinadon');
const H = require('highland');
var argv = require('yargs').argv
const fs = require('fs');

var bodySID = 0;
var tracks = new Map
var essenceData = new Map

var klvs = H(fs.createReadStream(argv._[0]))
  .through(kelviniser())
  .through(metatiser())
  .through(stripTheFiller)
  .through(detailing())
  .through(puppeteer())
  .doto(x => {
    if (x.meta.Symbol.indexOf('Partition') >= 0) {
      bodySID = x.detail.EssenceStreamID;
    }
  })
  .doto(x => {
    // if (x.ObjectClass === 'Preface')
      H.log(x);
  })
  .filter(x => x.meta.Symbol === 'EssenceElement')
  .map(x => ({
    bodySID: bodySID,
    track: x.detail.Track,
    type: x.detail.ItemType,
    start: x.filePos + 16 + x.lengthLength,
    end: x.filePos + 16 + x.lengthLength + x.length
  }))
  .doto(x => {
    let a = tracks.get(`${x.bodySID}-${x.track}`);
    if (!a) {
      a = [];
      tracks.set(`${x.bodySID}-${x.track}`, a);
    }
    a.push(x);
  })
  .errors(e => { console.error(e); })
  .done(() => {
    console.log(tracks.keys());
  })
