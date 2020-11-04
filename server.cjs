#!/usr/bin/env node

const cluster = require('cluster');
const {readdir, exists, rm, rmdir} = require('fs');
const {createServer} = require('http');
const {cpus, networkInterfaces} = require('os');
const {join, resolve} = require('path');

const {error, log, warn} = require('essential-md');

const cdn = require('./cjs/index.js');

const {fork, isMaster} = cluster;

const cwd = process.cwd();

const apiCache = new Map;

let port = 8080;
let cacheTimeout = 300000;
let clusters = 0;
let api = '';
let serve = '.';
let source = '.';
let dest = '';
let debug = false;
let help = false;
let preview = false;
let isServing = false;
let notServing = false;
let noImport = false;
let noMinify = false;
let sourceMap = false;
let verbose = false;
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
    case /^-t$/.test(argv[i]):
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
    case /^-p$/.test(argv[i]):
    case /^--port(=\d+)?$/.test(argv[i]):
      port = asInt(RegExp);
      break;

    // strings as paths
    case /^--api(=.+)?$/.test(argv[i]):
      api = asString(RegExp);
      break;
    case /^-d$/.test(argv[i]):
    case /^--(?:dest|cache)(=.+)?$/.test(argv[i]):
      dest = asString(RegExp);
      notServing = true;
      break;
    case /^--serve(=.+)?$/.test(argv[i]):
      serve = asString(RegExp);
      isServing = true;
      break;
    case /^-s$/.test(argv[i]):
    case /^--source(=.+)?$/.test(argv[i]):
      source = asString(RegExp);
      notServing = true;
      break;

    // no value needed
    case /^--debug$/.test(argv[i]):
      debug = true;
      verbose = true;
      noMinify = true;
      cacheTimeout = 500;
      break;
    case /^--no-imports?$/.test(argv[i]):
      noImport = true;
      break;
    case /^--no-min$/.test(argv[i]):
    case /^--no-minify$/.test(argv[i]):
      noMinify = true;
      break;
    case /^--preview$/.test(argv[i]):
    case /^--with-preview$/.test(argv[i]):
      preview = true;
      break;
    case /^--source-map$/.test(argv[i]):
    case /^--with-source-map$/.test(argv[i]):
      sourceMap = true;
      break;
    case /^-v$/.test(argv[i]):
    case /^--verbose$/.test(argv[i]):
      verbose = true;
      break;
    case /^--help$/.test(argv[i]):
    default:
      help = true;
      i = length;
      break;
  }
}

if (debug)
  (rm || rmdir)(dest ? resolve(cwd, dest) : '/tmp/ucdn', {recursive: true, force: true}, Object);

const header = `# micro cdn v${require(join(__dirname, 'package.json')).version}`;
if (help || (notServing && isServing)) {
  log(`
  ${header}
  -https://github.com/WebReflection/ucdn-

  *ucdn --source ./path/*
    \`--source ./\`        -# (\`-s\`) path to serve as CDN, default current folder-
    \`--dest /tmp\`        -# (\`-d\`) CDN cache path, default /tmp/ucdn-
    \`--cache-timeout X\`  -# (\`-t\`) cache expiration in ms, default 300000-
    \`--port XXXX\`        -# (\`-p\`) port to use, default 0 (any available port)-
    \`--cluster(s) X\`     -# number of forks, default 0-
    \`--serve /path\`      -# serve a CDN ready path without any runtime-
    \`--verbose\`          -# logs operations-
    \`--debug\`            -# 500ms cache timeout + no minification + verbose-
    \`--api ./api\`        -# use files in folder as API fallback-

  *ucompress* options
    \`--max-width X\`      -# max images width in pixels-
    \`--max-height X\`     -# max images height in pixels-
    \`--with-preview\`     -# enables *.preview.jpeg images-
    \`--with-source-map\`  -# enables source maps-
    \`--no-import\`        -# avoid resolving imports-
    \`--no-minify\`        -# do not minify sources-

  *aliases*
    \`--fork(s) X\`        -# alias for \`--cluster(s)\`-
    \`--cache /tmp\`       -# alias for \`--dest\`-
  `);
}
else if (isMaster && 0 < clusters) {
  let forks = clusters;
  let toBeGreeted = true;
  const onGreetings = usedPort => {
    if (toBeGreeted) {
      toBeGreeted = !toBeGreeted;
      greetings(usedPort);
    }
  };
  while (forks--)
    fork().on('message', onGreetings);
  cluster.on('exit', ({process}, code, signal) => {
    warn(`Worker *${process.pid}* died with code *${code}* and signal *${signal}*`);
    if (!(code == 1 && !signal))
      fork();
  });
}
else {
  const hasAPI = api !== '';
  if (hasAPI)
    api = resolve(cwd, api);
  const base = resolve(cwd, source);
  const meta = '<meta name="viewport" content="width=device-width,initial-scale=1.0"></meta>';
  const style = '<style>body{font-family:sans-serif;}a,a:visited{color:initial;}h1{font-size:initial;}</style>';
  const handler = cdn(isServing ? {cacheTimeout, serve} : {
    dest: dest ? resolve(cwd, dest) : '',
    source: base,
    cacheTimeout,
    maxWidth,
    maxHeight,
    preview,
    sourceMap,
    noImport,
    noMinify,
    verbose
  });
  const checkAPI = (req, res, url) => {
    const js = join(api, `${url.slice(1)}.js`);
    exists(js, exists => {
      if (exists) {
        try {
          const module = require(js);
          module(req, res);
          apiCache.set(url, module);
        }
        catch (o_O) {
          console.error(o_O);
          fail(res, url);
        }
      }
      else
        fail(res, url);
    });
  };
  const fail = (res, url) => {
    if (verbose)
      log(` *404* \`${url}\``);
    res.writeHead(404);
    res.end();
  };
  const redirect = (res, url) => {
    if (verbose)
      log(` *302* \`${url}/\``);
    res.writeHead(302, {'Location': `${url}/`});
    res.end();
  };
  const next = isServing ?
    ((req, res) => {
      const url = req.url.replace(/\/$/, '');
      if (hasAPI && apiCache.has(url))
        apiCache.get(url)(req, res);
      else if (/\.\w+(?:\?.*)?$/.test(url))
        fail(res, url);
      else {
        exists(join(base, url.slice(1), 'index.html'), exists => {
          if (exists)
            redirect(res, url);
          else if (hasAPI)
            checkAPI(req, res, url);
          else
            fail(res, url);
        });
      }
    }) :
    ((req, res) => {
      const url = req.url.replace(/\/$/, '');
      if (hasAPI && apiCache.has(url))
        apiCache.get(url)(req, res);
      else if (/\.\w+(?:\?.*)?$/.test(url))
        fail(res, url);
      else {
        exists(join(base, url.slice(1), 'index.html'), exists => {
          if (exists)
            redirect(res, url);
          else {
            const dir = join(base, url.slice(1));
            readdir(dir, (err, files) => {
              if (err) {
                if (hasAPI)
                  checkAPI(req, res, url);
                else
                  fail(res, url);
              }
              else {
                if (verbose)
                  log(` *200* -listing- \`${dir}\``);
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
                  if (!/^\./.test(file)) {
                    let link = join(dir, file).replace(base, '');
                    if (preview && /\.md$/i.test(link))
                      link += '.preview.html';
                    res.write(`<li><a href="${link}">${file}</a></li>`);
                  }
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
  createServer(($, _) => { handler($, _, next); })
    .on('error', function() {
      if (port == 8080)
        this.listen(0);
      else {
        error(`  port *${port}* is unavailable`);
        process.exit(1);
      }
    })
    .listen(port, greetings);
}

function greetings(newPort = this.address().port) {
  if (isMaster) {
    const checks = `(checked each ${(cacheTimeout / 60000) >>> 0} min)`;
    log(`\n${header}`);
    if (newPort != port)
      warn(`  port *${port}* not available, using *${newPort}* instead`);
    if (isServing) {
      log(`  -serving:- \`${resolve(cwd, serve)}\` -${checks}-`);
    }
    else {
      log(`  -source:-  \`${resolve(cwd, source)}\` -${checks}-`);
      log(`  -cache:-   \x1b[2m\`${dest ? resolve(cwd, dest) : '/tmp/ucdn'}\`\x1b[0m`);
    }
    if (api !== '')
      log(`  -api:-     \x1b[2m\`${api}\`\x1b[0m`);
    let config = [];
    if (clusters)
      config.push(`${clusters} -forks-`);
    if (preview)
      config.push('-preview-');
    if (sourceMap)
      config.push('-source map-');
    if (noImport)
      config.push('-no import-');
    if (noMinify)
      config.push('-no minification-');
    if (maxWidth)
      config.push(`-w${maxWidth}px-`);
    if (maxHeight)
      config.push(`-h${maxHeight}px-`);
    if (verbose)
      config.push(`-verbose-`);
    if (config.length)
      log(`  -config:-  ${config.join('-,- ')}`);
    log(`  -visit:-   *http://localhost${newPort == 80 ? '' : `:${newPort}`}/*`);
    const interfaces = networkInterfaces();
    Object.keys(interfaces).forEach(key => {
      interfaces[key].forEach(iFace => {
        const {address, family} = iFace;
        if (family === 'IPv4' && address !== '127.0.0.1')
          log(`           *http://${address}${newPort == 80 ? '' : `:${newPort}`}/*`);
      });
    });
    log('');
  }
  else
    process.send(newPort);
}
