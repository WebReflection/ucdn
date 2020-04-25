'use strict';
const {createReadStream, mkdir, unlink} = require('fs');
const {tmpdir} = require('os');
const {dirname, extname, join, resolve} = require('path');
const ucompress = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('ucompress'));

const {json, pack, stat} = require('./cache.js');

const {compressed} = ucompress;

const getPath = source => (source[0] === '/' ? source : resolve(source));

/* istanbul ignore next */
const internalServerError = res => {
  res.writeHead(500);
  res.end();
};

const readAndServe = (res, asset, cacheTimeout, ETag, same) =>
  json(asset, cacheTimeout).then(
    headers => serveFile(res, asset, headers, ETag, same),
    /* istanbul ignore next */
    () => internalServerError(res)
  );

const serveFile = (res, asset, headers, ETag, same) => {
  if (same && headers.ETag === ETag) {
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

module.exports = ({source, dest, headers, cacheTimeout: CT}) => {
  const SOURCE = getPath(source);
  const DEST = dest ? getPath(dest) : join(tmpdir(), 'ucdn');
  const options = {createFiles: true, headers};
  return (req, res, next) => {
    const path = req.url.replace(/\?.*$/, '');
    const original = SOURCE + path;
    stat(original, CT).then(
      ({lastModified, size}) => {
        if (path === '/favicon.ico')
          streamFile(res, original, {
            'Content-Length': size,
            'Content-Type': 'image/vnd.microsoft.icon',
            ...headers
          });
        else {
          let asset = DEST + path;
          let compression = '';
          const {
            ['accept-encoding']: AcceptEncoding,
            ['if-none-match']: ETag,
            ['if-modified-since']: Since
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
          const create = () => {
            const {length} = compression;
            /* istanbul ignore next */
            const compress = length ? asset.slice(0, -length) : asset;
            const waitForIt = compress + '.wait';
            mkdir(dirname(waitForIt), {recursive: true}, err => {
              /* istanbul ignore if */
              if (err)
                internalServerError(res);
              else 
                pack(asset, original, compress, options, CT)
                  .then(
                    () => {
                      readAndServe(res, asset, CT, ETag, false);
                    },
                    /* istanbul ignore next */
                    () => {
                      unlink(waitForIt, () => internalServerError(res));
                    }
                  );
            });
          };
          json(asset, CT).then(
            headers => {
              /* istanbul ignore else */
              if (lastModified === headers['Last-Modified'])
                serveFile(res, asset, headers, ETag, lastModified === Since);
              else
                create();
            },
            create
          );
        }
      },
      () => {
        if (next)
          next();
        else {
          res.writeHead(404);
          res.end();
        }
      }
    );
  };
};
