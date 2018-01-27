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

const express = require('express');
const app = express();
const fapp = express();
var basePath = process.argv[2];

app.get('/', (req, res) => res.json({ fred: 'Hello World!' }));

app.param('file', (req, res, next, file) => {
  req.file = basePath + '/' + file;
  next();
});

app.use('/:file', fapp);

fapp.get('/', (req, res) => res.json({ wibble: 42, params: req.file }));

app.listen(3000, () => console.log('Example app listening on port 3000!'));
