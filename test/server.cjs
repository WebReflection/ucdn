const {createServer} = require('http');
const {join} = require('path');

const cdn = require('../cjs');
const callback = cdn({
  cacheTimeout: 10000,
  source: join(__dirname, 'source'),
  dest: join(__dirname, 'dest')
});

createServer(callback).listen(8080);
