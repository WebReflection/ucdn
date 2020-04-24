const {fork, isMaster} = require('cluster');
const {createServer} = require('http');
const {cpus} = require('os');
const {join} = require('path');

const cdn = require('../cjs');

if (isMaster)
  cpus().forEach(() => fork());
else {
  const callback = cdn({
    cacheTimeout: 10000,
    source: join(__dirname, 'source'),
    dest: join(__dirname, 'dest')
  });
  createServer(callback).listen(8080);
}
