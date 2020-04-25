#!/usr/bin/env node

const {fork, isMaster} = require('cluster');
const {createServer} = require('http');
const {cpus} = require('os');
const {resolve} = require('path');

const cdn = require('./cjs/index.js');

let port = 8080;
let cluster = 0;
let source = '.';
let dest = '';
let help = false;

const greetings = () => {
  console.log('');
  console.log(`  \x1b[1mucdn\x1b[0m \x1b[2m${cluster ? `(${cluster} forks)` : ''}\x1b[0m`);
  console.log(`  \x1b[2mserving: ${resolve(process.cwd(), source)}\x1b[0m`);
  console.log(`  \x1b[2mcaching: ${dest ? resolve(process.cwd(), dest) : '/tmp/ucdn'}\x1b[0m`);
  console.log(`  \x1b[1mhttp://localhost${port == 80 ? '' : `:${port}`}/\x1b[0m`);
  console.log('');
};

for (let {argv} = process, i = 0; i < argv.length; i++) {
  switch (true) {
    case /^--help$/.test(argv[i]): {
      help = true;
      break;
    }
    case /^--cluster(=\d+)?$/.test(argv[i]): {
      const {$1} = RegExp;
      cluster = Math.min(
        parseInt($1 ? $1.slice(1) : argv[++i], 10),
        cpus().length
      );
      break;
    }
    case /^--port(=\d+)?$/.test(argv[i]): {
      const {$1} = RegExp;
      port = parseInt($1 ? $1.slice(1) : argv[++i], 10);
      break;
    }
    case /^--source(=.+)?$/.test(argv[i]): {
      const {$1} = RegExp;
      source = $1 ? $1.slice(1) : argv[++i];
      break;
    }
    case /^--dest(=.+)?$/.test(argv[i]): {
      const {$1} = RegExp;
      dest = $1 ? $1.slice(1) : argv[++i];
      break;
    }
  }
}

if (help) {
  console.log('');
  console.log(`\x1b[1mucdn --cluster 0 --port 8080 --source ./path/\x1b[0m`);
  console.log(`  --cluster X \x1b[2m# number of forks, default 0\x1b[0m`);
  console.log(`  --port XXXX \x1b[2m# port to use, default 8080\x1b[0m`);
  console.log(`  --source ./ \x1b[2m# path to serve as CDN, default current folder\x1b[0m`);
  console.log(`  --dest /tmp \x1b[2m# CDN cache path, default /tmp/ucdn\x1b[0m`);
  console.log('');
}
else if (isMaster && 0 < cluster) {
  let forks = cluster;
  while (forks--)
    fork();
  greetings();
}
else {
  const handler = cdn({
    cacheTimeout: 300000,
    source: resolve(process.cwd(), source),
    dest: dest ? resolve(process.cwd(), dest) : ''
  });
  createServer((req, res) => {
    const {headers, url} = req;
    handler({headers, url: url === '/' ? '/index.html' : url}, res);
  })
  .listen(port, isMaster ? greetings : Object);
}
