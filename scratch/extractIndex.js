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
var argv = require('yargs').argv;
const fs = require('fs');
const crypto = require('crypto');
const uuid = require('uuid');

var bodySID = 0;
var tracks = new Map;
var trackDescriptions = new Map;

var ptpBase = x => (d => [ d / 1000 | 0, (d % 1000) * 1000000])(new Date(x))

function makeID (pkid, trkID) {
  var hash = crypto.createHash('sha1');
  hash.update(Buffer.from(uuid.parse(pkid)));
  hash.update(typeof trkID === 'number' ? 'TrackID' + trkID : trkID, 'utf8');
  var dig = hash.digest();
  // Make a legal V5 UUID identifier wrt rfc4122
  dig[6] = (dig[6] & 0x0f) | 0x50;
  dig[8] = (dig[8] & 0x3f) | 0x80;
  return uuid.unparse(dig);
}

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
      EssenceTrackNumber: sourcePackage.TrackMap.get(descriptor.LinkedTrackID),
      EssenceDescription: descriptor
    };
    trackDescriptions.set(
      megaTrack.SourceID, megaTrack);
  }
}

H(fs.createReadStream(argv._[0]))
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
    if (x.ObjectClass === 'Preface') {
      x.ContentStorageObject.EssenceDataObjects.forEach(edo => {
        var sourcePackage = x.ContentStorageObject.Packages.find(y =>
          y.PackageID[1] === edo.LinkedPackageID[1]);
        sourcePackage.EssenceStreamID = edo.EssenceStreamID;
        sourcePackage.TrackMap = new Map(
          sourcePackage.PackageTracks.map(t => [
            t.TrackID, t.EssenceTrackNumber.toString(16)
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
        id: makeID(primaryPackage.packageID[1]),
        video : [],
        audio : [],
        backPressure : ''
      };
      console.log(cable);
    }
  })
  .filter(x => x.meta && x.meta.Symbol === 'EssenceElement')
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
  });
