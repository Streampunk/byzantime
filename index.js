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
  return details;
}

app.param('file', async (req, res, next, file) => {
  let fullPath = path.resolve(basePath, file);
  try {
    if (!fileDetails.get(fullPath)) {
      fileDetails.set(fullPath, gatherDetails(fullPath));
    }
    req.fileDetails = await fileDetails.get(fullPath);
    // console.log(req.fileDetails);
    console.log(`File ${req.fileDetails.file} has size ${req.fileDetails.fileStat.size}.`);
    // Start loading metadata
    req.fileDetails.material.then(d => { console.log('Got file details', d); });
    req.fileDetails.indexing.then(() => { console.log('Finished indexing.'); });
    next();
  } catch (e) {
    res.status(404);
    res.json({ status: 404, error : e, message: e.message });
  }
});

const fapp = express.Router();

app.use('/:file', fapp);

fapp.get('/', (req, res) => res.json(req.fileDetails));

fapp.get('cable.json', async (req, res) => {
  try {
    res.json(await req.fileDetails.material);
  } catch (e) {
    res.status(404);
    res.json({ status: 404, error : e, message: e.message });
  }
});

app.listen(3000, () => console.log('Example app listening on port 3000!'));
