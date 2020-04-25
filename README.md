# <em>µ</em>cdn

[![Build Status](https://travis-ci.com/WebReflection/ucdn.svg?branch=master)](https://travis-ci.com/WebReflection/ucdn) [![Coverage Status](https://coveralls.io/repos/github/WebReflection/ucdn/badge.svg?branch=master)](https://coveralls.io/github/WebReflection/ucdn?branch=master)

A [ucompress](https://github.com/WebReflection/ucompress#readme) based utility that accepts a configuration object with a `source` path, an optional `dest`, which fallbacks to the _temp_ folder, plus eventually extra `headers` property to pollute headers via `allow-origin` among other details.


### Example

The following example will serve every file within any folder in the `source` directory, automatically optimizing on demand all operations, including the creation of _brotli_, _gzip_, or _deflate_.

```js
import {createServer} from 'http';
import {join} from 'path';

import umeta from 'umeta';
const {dirName} = umeta(import.meta);

import ucdn from 'ucdn';
const callback = cdn({
  cacheTimeout: 1000 * 60, // 1 min cache
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



### Performance

Differently from other solutions, the compression is done once, and once only, per each required static asset, reducing both _RAM_ and _CPU_ overhead in the long run, but being a bit slower than express static, with or without compressed outcome, in the very first time a file, that hasn't been optimized yet, is requested.

However, once each file cache is ready, _µcdn_ is _1.2x_, up to _2.5x_, faster than express with static and compress, and it performs specially well in _IoT_ devices that are capable of running NodeJS.



### About `cacheTimeout`

The purpose of this module is to do the least amount of disk operations, including lightweight operations such as `fs.stat(...)` or `fs.readFile(...)`.
There are also heavy operations such the runtime compression, which should be guarded against concurrent requests.

In order to do so, _µcdn_ uses an internal cache mechanism that avoid checking stats, parsing _JSON_, or compressing missing or updated assets during this timeout, which is by default _1000_ milliseconds.

If you pass a timeout with value `0`, it will never check ever again anything, and all _JSON_ headers and stats results will be kept in _RAM_ until the end of the program, unless some file is missing, or some error occurs.

In every other case, using a minute, up to 10 minutes, as cache timeout, is rather suggested.
