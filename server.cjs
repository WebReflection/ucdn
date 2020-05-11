#!/usr/bin/env node

const cluster = require('cluster');
const {readdir, exists} = require('fs');
const {createServer} = require('http');
const {cpus, networkInterfaces} = require('os');
const {join, resolve} = require('path');

const cdn = require('./cjs/index.js');

const {fork, isMaster} = cluster;

let port = 0;
let cacheTimeout = 300000;
let clusters = 0;
let serve = '.';
let source = '.';
let dest = '';
let help = false;
let preview = false;
let isServing = false;
let notServing = false;
let noMinify = false;
let sourceMap = false;
let maxWidth, maxHeight;

for (let
  {max, min} = Math, {argv} = process,
  {length} = argv, i = 2; i < length; i++
) {

  // utils
  const asInt = ({$1}) => parseInt($1 ? $1.slice(1) : argv[++i], 10);
  const asString = ({$1}) => ($1 ? $1.slice(1) : argv[++i]);

  switch (true) {

    // integers
    case /^--cache-timeout(=\d+)?$/.test(argv[i]):
      cacheTimeout = asInt(RegExp);
      break;
    case /^--(?:cluster|fork)s?(=\d+)?$/.test(argv[i]):
      const amount = asInt(RegExp);
      clusters = max(0, min(amount, cpus().length)) || 0;
      break;
    case /^--max-width(=\d+)?$/.test(argv[i]):
      maxWidth = asInt(RegExp);
      break;
    case /^--max-height(=\d+)?$/.test(argv[i]):
      maxHeight = asInt(RegExp);
      break;
    case /^--port(=\d+)?$/.test(argv[i]):
      port = asInt(RegExp);
      break;

    // strings as paths
    case /^--(?:dest|cache)(=.+)?$/.test(argv[i]):
      dest = asString(RegExp);
      notServing = true;
      break;
    case /^--serve(=.+)?$/.test(argv[i]):
      serve = asString(RegExp);
      isServing = true;
      break;
    case /^--source(=.+)?$/.test(argv[i]):
      source = asString(RegExp);
      notServing = true;
      break;

    // no value needed
    case /^--no-minify$/.test(argv[i]):
      noMinify = true;
      break;
    case /^--with-preview$/.test(argv[i]):
      preview = true;
      break;
    case /^--with-source-map$/.test(argv[i]):
      sourceMap = true;
      break;
    case /^--help$/.test(argv[i]):
    default:
      help = true;
      i = length;
      break;
  }
}

if (help || (notServing && isServing)) {
  console.log('');
  console.log(`\x1b[1mucdn --source ./path/\x1b[0m`);
  console.log(`  --cluster X        \x1b[2m# number of forks, default 0\x1b[0m`);
  console.log(`  --cache /tmp       \x1b[2m# CDN cache path, default /tmp/ucdn\x1b[0m`);
  console.log(`  --cache-timeout X  \x1b[2m# cache expiration in ms, default 300000\x1b[0m`);
  console.log(`  --max-width X      \x1b[2m# max images width in pixels\x1b[0m`);
  console.log(`  --max-height X     \x1b[2m# max images height in pixels\x1b[0m`);
  console.log(`  --port XXXX        \x1b[2m# port to use, default 0 (any available port)\x1b[0m`);
  console.log(`  --serve /path      \x1b[2m# serve a CDN ready path without any runtime\x1b[0m`);
  console.log(`  --source ./        \x1b[2m# path to serve as CDN, default current folder\x1b[0m`);
  console.log(`  --with-preview     \x1b[2m# enables *.preview.jpeg images\x1b[0m`);
  console.log(`  --with-source-map  \x1b[2m# enables source maps\x1b[0m`);
  console.log(`  --no-minify        \x1b[2m# do not minify sources\x1b[0m`);
  console.log('');
  console.log(`\x1b[1maliases\x1b[0m`);
  console.log(`  --fork X           \x1b[2m# alias for --cluster\x1b[0m`);
  console.log(`  --dest /tmp        \x1b[2m# alias for --cache\x1b[0m`);
  console.log('');
}
else if (isMaster && 0 < clusters) {
  let forks = clusters;
  let toBeGreeted = true;
  const onGreetings = port => {
    if (toBeGreeted) {
      toBeGreeted = !toBeGreeted;
      greetings(port);
    }
  };
  while (forks--)
    fork().on('message', onGreetings);
  cluster.on('exit', ({process}, code, signal) => {
    console.warn(`Worker ${process.pid} died with code ${code} and signal ${signal}`);
    fork();
  });
}
else {
  const base = resolve(process.cwd(), source);
  const meta = '<meta name="viewport" content="width=device-width,initial-scale=1.0"></meta>';
  const style = '<style>body{font-family:sans-serif;}a,a:visited{color:initial;}h1{font-size:initial;}</style>';
  const handler = cdn(isServing ? {cacheTimeout, serve} : {
    dest: dest ? resolve(process.cwd(), dest) : '',
    source: base,
    cacheTimeout,
    maxWidth,
    maxHeight,
    preview,
    sourceMap,
    noMinify
  });
  const fail = res => {
    res.writeHead(404);
    res.end();
  };
  const redirect = (res, url) => {
    res.writeHead(302, {'Location': `${url}/index.html`});
    res.end();
  };
  const next = isServing ?
    ((req, res) => {
      const url = req.url.replace(/\/$/, '');
      if (/\.\w+(?:\?.*)?$/.test(url))
        fail(res);
      else {
        exists(join(base, url, 'index.html'), exists => {
          (exists ? redirect : fail)(res, url);
        });
      }
    }) :
    ((req, res) => {
      const url = req.url.replace(/\/$/, '');
      if (/\.\w+(?:\?.*)?$/.test(url))
        fail(res);
      else {
        exists(join(base, url, 'index.html'), exists => {
          if (exists)
            redirect(res, url);
          else {
            const dir = join(base, url);
            readdir(dir, (err, files) => {
              if (err)
                fail(res);
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
                    res.write(`<li><a href="${join(dir, file).replace(base, '')}">${file}</a></li>`);
                });
                res.write(`</ul></body></html>`);
                res.end();
              }
            });
          }
        });
      }
    })
  ;
  createServer(($, _) => { handler($, _, next); }).listen(port, greetings);
}

function greetings(port = this.address().port) {
  if (isMaster) {
    const checks = `\x1b[2m(checked each ${(cacheTimeout / 60000) >>> 0} min)\x1b[0m`;
    console.log('');
    console.log(`  \x1b[1mucdn\x1b[0m \x1b[2m${clusters ? `(${clusters} forks)` : ''}\x1b[0m`);
    if (isServing) {
      console.log(`  \x1b[2mserving:\x1b[0m ${resolve(process.cwd(), serve)} ${checks}`);
    }
    else {
      console.log(`  \x1b[2msource: \x1b[0m ${resolve(process.cwd(), source)} ${checks}`);
      console.log(`  \x1b[2mcache:   ${dest ? resolve(process.cwd(), dest) : '/tmp/ucdn'}\x1b[0m`);
    }
    console.log(`  \x1b[2mvisit:  \x1b[0m \x1b[1mhttp://localhost${port == 80 ? '' : `:${port}`}/\x1b[0m`);
    const interfaces = networkInterfaces();
    Object.keys(interfaces).forEach(key => {
      interfaces[key].forEach(iFace => {
        const {address, family} = iFace;
        if (family === 'IPv4' && address !== '127.0.0.1')
          console.log(`           \x1b[1mhttp://${address}${port == 80 ? '' : `:${port}`}/\x1b[0m`);
      });
    });
    console.log('');
  }
  else
    process.send(port);
}
