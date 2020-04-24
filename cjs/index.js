'use strict';
const {
  createReadStream, stat, mkdir, readFile, unlink, existsSync, writeFileSync, watchFile, unwatchFile
} = require('fs');
const {tmpdir} = require('os');
const {dirname, extname, join, resolve} = require('path');

const ucompress = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('ucompress'));

const {parse} = JSON;
const {compressed} = ucompress;

const FAVICON = '/favicon.ico';
const FAVICON_LENGTH = -(FAVICON.length);

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

const getPath = source => (source[0] === '/' ? source : resolve(source));

const serveFile = (res, asset, headers, IfNoneMatch) => {
  const {ETag, ['Last-Modified']: LastModified} = headers;
  if (ETag === IfNoneMatch) {
    res.writeHead(304, headers);
    res.end();
  }
  else {
    res.writeHead(
      200,
      asset.slice(FAVICON_LENGTH) === FAVICON ?
        {
          'Content-Length': headers['Content-Length'],
          'Content-Type': 'image/vnd.microsoft.icon',
          'Last-Modified': LastModified
        } :
        headers
    );
    createReadStream(asset).pipe(res);
  }
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
      else {
        let asset = DEST + path;
        let compression = '';
        const {
          ['accept-encoding']: AcceptEncoding,
          ['if-none-match']: IfNoneMatch
        } = req.headers;
        if (
          compressed.has(extname(path).toLowerCase()) &&
          /\b(br|gzip|deflate)\b/.test(AcceptEncoding)
        ) {
          compression = '.' + RegExp.$1;
          asset += compression;
        }
        readFile(asset + '.json', (err, data) => {
          if (err) {
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
          }
          else
            serveFile(res, asset, parse(data), IfNoneMatch);
        });
      }
    });
  };
};
