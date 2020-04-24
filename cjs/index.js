'use strict';
const {
  createReadStream, stat, mkdir, readFile, unlink, existsSync, writeFileSync, watchFile, unwatchFile
} = require('fs');
const {tmpdir} = require('os');
const {dirname, extname, join, resolve} = require('path');

const ucompress = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('ucompress'));

const {parse} = JSON;
const {compressed} = ucompress;

const getPath = source => (source[0] === '/' ? source : resolve(source));

/* istanbul ignore next */
const internalServerError = res => {
  res.writeHead(500);
  res.end();
};

const readAndServe = (res, asset, IfNoneMatch) => {
  readFile(asset + '.json', (err, data) => {
    /* istanbul ignore next */
    if (err)
      internalServerError(res);
    else
      serveFile(res, asset, parse(data), IfNoneMatch);
  });
};

const serveFile = (res, asset, headers, IfNoneMatch) => {
  if (headers.ETag === IfNoneMatch) {
    res.writeHead(304, headers);
    res.end();
  }
  else
    streamFile(res, asset, headers);
};

const streamFile = (res, asset, headers) => {
  res.writeHead(200, headers);
  createReadStream(asset).pipe(res);
};

module.exports = ({source, dest, headers}) => {
  const SOURCE = getPath(source);
  const DEST = dest ? getPath(dest) : join(tmpdir(), 'ucdn');
  const options = {createFiles: true, headers};
  return (req, res, next) => {
    const path = req.url.replace(/\?.*$/, '');
    const original = SOURCE + path;
    stat(original, (err, stats) => {
      if (err || !stats.isFile()) {
        if (next)
          next();
        else {
          res.writeHead(404);
          res.end();
        }
      }
      else if (path === '/favicon.ico')
        streamFile(res, original, {
          'Content-Length': stats.size,
          'Content-Type': 'image/vnd.microsoft.icon',
          ...headers
        });
      else {
        let asset = DEST + path;
        let compression = '';
        const {
          ['accept-encoding']: AcceptEncoding,
          ['if-none-match']: IfNoneMatch,
          ['if-modified-since']: IfModifiedSince
        } = req.headers;
        if (compressed.has(extname(path).toLowerCase())) {
          switch (true) {
            /* istanbul ignore next */
            case /\bbr\b/.test(AcceptEncoding):
              compression = '.br';
              break;
            case /\bgzip\b/.test(AcceptEncoding):
              compression = '.gzip';
              break;
            /* istanbul ignore next */
            case /\bdeflate\b/.test(AcceptEncoding):
              compression = '.deflate';
              break;
          }
          asset += compression;
        }
        readFile(asset + '.json', (err, data) => {
          // if there was no error, be sure the source file is still the same
          if (!err) {
            const headers = parse(data);
            if (new Date(stats.mtimeMs).toUTCString() === IfModifiedSince) {
              serveFile(res, asset, headers, IfNoneMatch);
              return;
            }
          }
          // if the file was modified, re-optimize it, assuming it changed too
          const {length} = compression;
          const compress = length ? asset.slice(0, -length) : asset;
          const waitForIt = compress + '.wait';
          mkdir(dirname(waitForIt), {recursive: true}, err => {
            /* istanbul ignore next */
            if (err)
              internalServerError(res);
            else if (existsSync(waitForIt))
              watchFile(waitForIt, () => {
                unwatchFile(waitForIt);
                readAndServe(res, asset, IfNoneMatch);
              });
            else {
              try {
                writeFileSync(waitForIt, path);
                ucompress(original, compress, options)
                  .then(
                    () => {
                      unlink(waitForIt, err => {
                        /* istanbul ignore next */
                        if (err)
                          internalServerError(res);
                        else
                          readAndServe(res, asset, IfNoneMatch);
                      });
                    },
                    /* istanbul ignore next */
                    () => unlink(waitForIt, () => internalServerError(res))
                  );
              }
              catch (o_O) {
                /* istanbul ignore next */
                internalServerError(res);
              }
            }
          });
        });
      }
    });
  };
};
