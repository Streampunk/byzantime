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

const fs = require('fs');
const H = require('highland');
const {
  kelviniser,
  metatiser,
  stripTheFiller,
  detailing,
  puppeteer
} = require('kelvinadon');
const crypto = require('crypto');
const uuid = require('uuid');

const ptpBase = x => (d => [ d / 1000 | 0, (d % 1000) * 1000000])(new Date(x));

function makeID (pkid, trkID) {
  let hash = crypto.createHash('sha1');
  hash.update(Buffer.from(uuid.parse(pkid)));
  hash.update(typeof trkID === 'number' ? 'TrackID' + trkID : trkID, 'utf8');
  let dig = hash.digest();
  // Make a legal V5 UUID identifier wrt rfc4122
  dig[6] = (dig[6] & 0x0f) | 0x50;
  dig[8] = (dig[8] & 0x3f) | 0x80;
  return uuid.unparse(dig);
}

function* filter (i, f) {
  do {
    var n = i.next();
    if (n.value && f(n.value)) yield n.value;
  } while (!n.done);
}

module.exports = function (file) {
  let materialFulfil = null;
  let materialReject = null;
  let bodySID = 0;
  let index = new Map;
  let trackDescriptions = new Map;
  let material = new Promise((fulfil, reject) => {
    materialFulfil = fulfil;
    materialReject = reject;
  });

  function addDescription(descriptor, sourcePackage) {
    if (descriptor.ObjectClass === 'MultipleDescriptor') {
      descriptor.FileDescriptors.forEach(d => {
        addDescription(d, sourcePackage);
      });
    } else {
      let megaTrack = {
        SourcePackageID: sourcePackage.PackageID,
        TrackID: descriptor.LinkedTrackID,
        DescriptorCreationTime: sourcePackage.CreationTime,
        EssenceStreamID: sourcePackage.EssenceStreamID,
        SourceID: makeID(sourcePackage.PackageID[1], descriptor.LinkedTrackID),
        EssenceDescription: descriptor
      };
      [ megaTrack.EssenceTrackNumber, megaTrack.TrackType ] =
        sourcePackage.TrackMap.get(descriptor.LinkedTrackID);
      trackDescriptions.set(
        megaTrack.SourceID, megaTrack);
    }
  }

  let indexing = H(fs.createReadStream(file))
    .through(kelviniser())
    .through(metatiser())
    .through(stripTheFiller)
    .through(detailing())
    .through(puppeteer())
    .doto(x => {
      if (x.meta && x.meta.Symbol.indexOf('Partition') >= 0) {
        bodySID = x.detail.EssenceStreamID;
      }
    })
    .doto(x => {
      // console.log('>>>', x.ObjectClass ? x.ObjectClass : x.meta.Symbol);
      if (x.ObjectClass === 'Preface') {
        x.ContentStorageObject.EssenceDataObjects.forEach(edo => {
          let sourcePackage = x.ContentStorageObject.Packages.find(y =>
            y.PackageID[1] === edo.LinkedPackageID[1]);
          sourcePackage.EssenceStreamID = edo.EssenceStreamID;
          sourcePackage.TrackMap = new Map(
            sourcePackage.PackageTracks.map(t => [
              t.TrackID, [ t.EssenceTrackNumber.toString(16), t.TrackSegment.ComponentDataDefinition ]
            ]));
          sourcePackage.OriginTimeBase = ptpBase(sourcePackage.CreationTime);
          addDescription(sourcePackage.EssenceDescription, sourcePackage);
          // console.log(trackDescriptions);
        });
        let primaryPackage = x.ContentStorageObject.Packages.find(y =>
          y.PackageID[1] === x.primaryPackage);
        if (!primaryPackage) {
          primaryPackage = x.ContentStorageObject.Packages.find(y =>
            y.ObjectClass === 'MaterialPackage');
        }
        // console.log(primaryPackage);
        primaryPackage.OriginTimeBase = ptpBase(primaryPackage.CreationTime);
        let cable = {
          id: primaryPackage.PackageID[1],
          video : Array.from(
            filter(trackDescriptions.values(),
              y => y.TrackType && y.TrackType === 'PictureEssenceTrack')),
          audio : Array.from(
            filter(trackDescriptions.values(),
              y => y.TrackType && y.TrackType === 'SoundEssenceTrack')),
          backPressure : ''
        };
        materialFulfil(cable);
      }
    })
    .consume((err, x, push, next) => {
      if (err) {
        if (err.toString().match(/unknown key/) === null) {
          console.error('MaterialReject', err);
          return materialReject(err);
        }
        return next();
      }
      if (x === H.nil) { return push(null, x); }
      push(null, x);
      next();
    })
    .filter(x => x.meta && x.meta.Symbol === 'EssenceElement')
    .doto(x => {
      let el = {
        bodySID: bodySID,
        track: x.detail.Track,
        type: x.detail.ItemType,
        start: x.filePos + 16 + x.lengthLength,
        end: x.filePos + 16 + x.lengthLength + x.length
      };

      let a = index.get(`${el.bodySID}-${el.track}`);
      if (!a) {
        a = [];
        index.set(`${el.bodySID}-${el.track}`, a);
      }
      a.push(el);
      return el;
    })
    .append(index)
    .last()
    .errors(e => {
      if (e.match(/unknown key/) === null)
        console.error('IndexReject', e);
    })
    .toPromise(Promise);

  return { index, indexing, material };
};
