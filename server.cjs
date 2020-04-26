#!/usr/bin/env node

const cluster = require('cluster');
const {readdir, exists} = require('fs');
const {createServer} = require('http');
const {cpus} = require('os');
const {join, resolve} = require('path');

const cdn = require('./cjs/index.js');

const {fork, isMaster} = cluster;

let port = 8080;
let clusters = 0;
let source = '.';
let dest = '';
let help = false;

const greetings = () => {
  console.log('');
  console.log(`  \x1b[1mucdn\x1b[0m \x1b[2m${clusters ? `(${clusters} forks)` : ''}\x1b[0m`);
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
      clusters = Math.min(
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
else if (isMaster && 0 < clusters) {
  let forks = clusters;
  while (forks--)
    fork();
  cluster.on('exit', (worker, code, signal) => {
    console.warn(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    fork();
  });
  greetings();
}
else {
  const base = resolve(process.cwd(), source);
  const meta = '<meta name="viewport" content="width=device-width,initial-scale=1.0"></meta>';
  const style = '<style>body{font-family:sans-serif;}a,a:visited{color:initial;}h1{font-size:initial;}</style>';
  const handler = cdn({
    cacheTimeout: 300000,
    source: base,
    dest: dest ? resolve(process.cwd(), dest) : ''
  });
  const next = (req, res) => {
    const {url} = req;
    if (/\.\w+(?:\?.*)?$/.test(url)) {
      res.writeHead(404);
      res.end();
    }
    else {
      exists(join(base, url, 'index.html'), exists => {
        if (exists) {
          res.writeHead(302, {'Location': 'index.html'});
          res.end();
        }
        else {
          const dir = join(base, url);
          readdir(dir, (err, files) => {
            if (err)
              res.writeHead(404);
            else {
              res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
              res.write(`<!doctype html><html><head>${
                meta
              }<title>${
                dir
              }</title>${
                style
              }</head><body><h1>${
                dir
              }</h1><ul>`);
              files.forEach(file => {
                if (!/^\./.test(file))
                  res.write(`<li><a href="${file}">${file}</a></li>`);
              });
              res.write(`</ul></body></html>`);
            }
            res.end();
          });
        }
      });
    }
  };
  createServer((req, res) => { handler(req, res, next); })
  .listen(port, isMaster ? greetings : Object);
}
