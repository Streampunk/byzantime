/* Copyright 2017 Streampunk Media Ltd.

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

const express = require('express');
const app = express();
const fapp = express();
const fs = require('fs');
const util = require('util');
var basePath = process.argv[2];
const fsstat = util.promisify(fs.stat);
const fsaccess = util.promisify(fs.access);
const fsreaddir = util.promisify(fs.readdir);

app.get('/', async (req, res) =>
  try {
    await 
  } catch (e) {

  }
));

app.param('file', async (req, res, next, file) => {
  req.file = basePath + '/' + file;
  try {
    await fsaccess(req.file, fs.R_OK);
    var fileStat = await fsstat(req.file);
    req.fileSize = fileStat.size;
    console.log(`File ${req.file} has size ${req.fileSize}.`);
    next();
  } catch (e) {
    res.status(404);
    res.json({ status: 404, error : e, message: e.message });
  }
});

app.use('/:file', fapp);

fapp.get('/', (req, res) => res.json({ wibble: 42, params: req.file }));

app.listen(3000, () => console.log('Example app listening on port 3000!'));
