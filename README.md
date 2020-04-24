# <em>µ</em>cdn

[![Build Status](https://travis-ci.com/WebReflection/ucdn.svg?branch=master)](https://travis-ci.com/WebReflection/ucdn) [![Coverage Status](https://coveralls.io/repos/github/WebReflection/ucdn/badge.svg?branch=master)](https://coveralls.io/github/WebReflection/ucdn?branch=master)

A [ucompress](https://github.com/WebReflection/ucompress#readme) based utility that accepts a configuration object with a `source` path, an optional `dest`, which fallbacks to the _temp_ folder, plus eventually extra `headers` property to pollute headers via `allow-origin` among other details.

#### Example

The following example will serve every file within any folder in the `source` directory, automatically optimizing on demand all operations, including the creation of _brotli_, _gzip_, or _deflate_.

```js
import {createServer} from 'http';
import {join} from 'path';

import umeta from 'umeta';
const {dirName} = umeta(import.meta);

import ucdn from 'ucdn';
const callback = cdn({
  source: join(dirName, 'source'),
  // dest: join(dirName, 'dest')
});

createServer(callback).listen(8080);
```

The callback works with _Express_ too, and similar modules, where all non existent files in the source folder will be ignored, and anything else will execute regularly.

```js
const {join} = require('path');

const express = require('express');
const ucdn = require('ucdn');

const app = express();
app.use(ucdn({
  source: join(__dirname, 'source'),
  dest: join(__dirname, 'dest')
}));
app.get('/unknown', (req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});
app.listen(8080);

```

#### Performance

Differently from other solutions, the compression is done once, and once only, per each required static asset, reducing both _RAM_ and _CPU_ overhead in the long run, but being a bit slower than express static, with or without compressed outcome, in the very first time a file, that hasn't been optimized yet, is requested.

However, once each file cache is ready, _µcdn_ is _1.2x_, up to _2.5x_, faster than express with static and compress, and it performs specially well in _IoT_ devices that are capable of running NodeJS.
