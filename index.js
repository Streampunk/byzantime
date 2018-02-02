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

/* Given a folder of MXF files, the app treats each file as an element of
   content. On first access, the app indexes the file, providing a cable
   description and access to the elements of each contained flow via a
   PTP timestamp and index.
*/

const express = require('express');
const app = express();
const fs = require('fs');
const util = require('util');
const fsstat = util.promisify(fs.stat);
const fsaccess = util.promisify(fs.access);
const fsreaddir = util.promisify(fs.readdir);
const path = require('path');
const extractData = require('./lib/extractData.js');
const { makeCable, formatPTP, ptpIndex } = require('./lib/cableUtils.js');
const H = require('highland');
const elementPipe = require('./lib/elementPipe.js');

var argv = require('yargs').argv;
const basePath = argv._[0];

const fileDetails = new Map;

app.get('/', async (req, res) => {
  try {
    let listing = await fsreaddir(basePath);
    res.json(listing.filter(x => x.toLowerCase().endsWith('.mxf')));
  } catch (e) {
    res.status(404);
    res.json({ status: 404, error: e, message: e.message});
  }
});

async function gatherDetails (fullPath) {
  await fsaccess(fullPath, fs.R_OK);
  let details = {
    file: fullPath,
    access: fs.R_OK
  };
  details.fileStat = await fsstat(fullPath);
  ({ index: details.index, material: details.material,
    indexing: details.indexing } = extractData(fullPath));
  details.material = details.material.then(makeCable);
  return details;
}

const fapp = express.Router();
const streamTypes = [ 'video', 'audio' ];

function addStreams (cable) {
  let streams = new Map;
  streamTypes.forEach(type => {
    if (!Array.isArray(cable[type])) return;
    for ( let [idx, el] of cable[type].entries() ) {
      streams.set(el.name, el);
      streams.set(el.flowID, el);
      streams.set(`${type}[${idx}]`, el);
    }
  });
  return streams;
}

app.param('file', async (req, res, next, file) => {
  let fullPath = path.resolve(basePath, file);
  try {
    if (!fileDetails.get(fullPath)) {
      let gather = gatherDetails(fullPath);
      fileDetails.set(fullPath, gather);
      req.fileDetails = await gather;
      console.log(`File ${req.fileDetails.file} has size ${req.fileDetails.fileStat.size}.`);
      // Start loading metadata
      // req.fileDetails.material.then(d => { console.log('Got file details', d); });
      req.fileDetails.streams = req.fileDetails.material.then(addStreams);
      req.fileDetails.indexed = false;
      req.fileDetails.indexing.then(() => {
        req.fileDetails.indexed = true;
        console.log('Finished indexing', fullPath); });
    } else {
      req.fileDetails = await fileDetails.get(fullPath);
    }
    next();
  } catch (e) {
    res.status(404);
    res.json({ status: 404, error : e, message: e.message });
  }
});

app.use('/:file', fapp);

fapp.get('/', (req, res) => res.json(req.fileDetails));

fapp.get('/cable.json', async (req, res) => {
  try {
    res.json(await req.fileDetails.material);
  } catch (e) {
    res.status(404);
    res.json({ status: 404, error : e, message: e.message });
  }
});

fapp.param('stream', async (req, res, next, stream) => {
  try {
    let streams = await req.fileDetails.streams;
    req.stream = streams.get(stream);
    if (!stream) throw new Error(`Stream ${stream} not available for ${req.fileDetails.fullPath}.`);
    next();
  } catch (e) {
    res.status(404);
    res.json({ status: 404, error : e, message: e.message });
  }
});

fapp.get('/:stream/wire.json', (req, res) => {
  res.json(req.stream);
});

fapp.get([
  '/:stream/:ptp(\\d+:\\d+)',
  '/:stream/:ptp(\\d+:\\d+).:fmt' ], (req, res) => {

  res.json(req.params);
});

fapp.get([
  '/:stream/:ptpfrom(\\d+:\\d+)-:ptpto(\\d+:\\d+)',
  '/:stream/:ptpfrom(\\d+:\\d+)-:ptpto(\\d+:\\d+).:fmt' ], (req, res) => {

  res.json(req.params);
});

fapp.get([
  '/:stream/:idx(\\d+)',
  '/:stream/:idx(\\d+).:fmt' ], (req, res) => {

  let index = req.fileDetails.index.get(req.stream.indexRef);
  let elIdx = +req.params.idx;
  if (Array.isArray(index)) {
    if (elIdx >= index.length) {
      if (req.fileDetails.indexed === false) {
        return res.status(400).json({ status: 400, message: 'Still indexing.'});
      } else {
        return res
          .status(405)
          .set('Allow', '')
          .json({ status: 405, message: `Requested index outside range 0-${index.length - 1}.`});
      }
    }
  } else {
    if (req.fileDetails.indexed === false) {
      return res.status(400).json({ status: 400, message: 'Still indexing.'});
    } else {
      return res.status(500).json({ status: 400, message : 'Failed to index file.' });
    }
  }

  let el = index[elIdx];
  if (req.params.fmt === 'idx')
    return res.json({ 0 : el });

  let ts = ptpIndex(req.stream.baseTime, elIdx, req.stream.description.SampleRate);
  let tsf = formatPTP(ts);
  if (req.params.fmt === 'json') {
    let detail = {};
    detail[tsf] = {
      position: 0,
      length: el.end - el.start + 1,
      type: 'raw'
    };
    return res.json(detail);
  }

  res.set('Content-Length', el.end - el.start + 1);
  res.set('Content-Type', 'application/octet-stream'); // TODO make real
  res.set('Arachnid-PTPOrigin', tsf);
  res.set('Arachnid-PTPSync', tsf); // TODO relate to material package
  res.set('Arachnid-FlowID', req.stream.flowID);
  res.set('Arachnid-SourceID', req.stream.sourceID);
  res.set('Arachnid-GrainDuration',
    `${req.stream.description.SampleRate[1]}/${req.stream.description.SampleRate[0]}`);
  // TODO timecode, packing

  fs.createReadStream(req.fileDetails.file, {
    start: el.start,
    end: el.end,
  }).pipe(res);
});

fapp.get([
  '/:stream/:idxfrom(\\d+)-', // open ended
  '/:stream/:idxfrom(\\d+)-:idxto(\\d+)',
  '/:stream/:idxfrom(\\d+)-:idxto(\\d+).:fmt' ], (req, res) => {

  let [ fromidx, toidx ] = [ +req.params.idxfrom, +req.params.idxto ];
  if (!isNaN(toidx) && toidx < fromidx) {
    return res
      .status(400)
      .json({ status: 400, message: `Range cannot be backwards. Given ${fromidx}-${toidx}.`});
  }
  let index = req.fileDetails.index.get(req.stream.indexRef);

  if (Array.isArray(index)) {
    if (isNaN(toidx)) toidx = index.length - 1;
    if (toidx >= index.length) {
      if (req.fileDetails.indexed === false) {
        return res.status(400).json({ status: 400, message: 'Still indexing.'});
      } else {
        return res
          .status(405)
          .set('Allow', '')
          .json({ status: 405, message: `Requested index outside range 0-${index.length - 1}.`});
      }
    }
  } else {
    if (req.fileDetails.indexed === false) {
      return res.status(400).json({ status: 400, message: 'Still indexing.'});
    } else {
      return res.status(500).json({ status: 400, message : 'Failed to index file.' });
    }
  }

  let els = index.slice(fromidx, toidx + 1);

  if (req.params.fmt === 'idx')
    return res.json(els.reduce((acc, cur, i) => { acc[i] = cur; return acc;}, {}));

  let ts = ptpIndex(req.stream.baseTime, fromidx, req.stream.description.SampleRate);
  let tsf = formatPTP(ts);
  if (req.params.fmt === 'json') {
    let detail = {};
    let position = 0;
    for ( let [i, v] of els.entries() ) {
      let elTs = ptpIndex(req.stream.baseTime, fromidx + i, req.stream.description.SampleRate);
      let length = v.end - v.start + 1;
      detail[formatPTP(elTs)] = {
        position: position,
        length: length,
        type: 'raw'
      };
      position += length;
    }
    return res.json(detail);
  }

  res.set('Content-Length', els.reduce((acc, cur) => acc + (cur.end - cur.start + 1), 0));
  res.set('Content-Type', 'application/octet-stream'); // TODO make real
  res.set('Arachnid-PTPOrigin', tsf);
  res.set('Arachnid-PTPSync', tsf); // TODO relate to material package
  res.set('Arachnid-FlowID', req.stream.flowID);
  res.set('Arachnid-SourceID', req.stream.sourceID);
  res.set('Arachnid-GrainDuration',
    `${req.stream.description.SampleRate[1]}/${req.stream.description.SampleRate[0]}`);
  res.set('Arachnid-GrainCount', els.length);
  let firstGap = els[0].end - els[0].start;
  if (els.every(el => el.end - el.start === firstGap))
    res.set('Arachnid-GrainSize', firstGap);
  // TODO timecode, packing

  H(fs.createReadStream(req.fileDetails.file,
    {
      start: els[0].start,
      end: els.slice(-1)[0].end
    }))
    .through(elementPipe(els[0].start, els))
    .pipe(res);
});

app.listen(3000, () => console.log('Example app listening on port 3000!'));
