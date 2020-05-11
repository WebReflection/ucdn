import {tmpdir} from 'os';
import {join} from 'path';

import {
  compression, fallback, favicon, json,
  serve as justServe, serveFile,
  getHeaders, getPath, getURL
} from 'ucdn-utils';

import {dir, pack, stat} from './cache.js';

/* istanbul ignore next */
const internalServerError = res => {
  res.writeHead(500);
  res.end();
};

const readAndServe = (res, asset, cacheTimeout, ETag, fail, same) => {
  json(asset, cacheTimeout).then(
    headers => {
      serveFile(res, asset, headers, ETag, same);
    },
    /* istanbul ignore next */
    fail
  );
};

export default ({
  source,
  dest,
  headers,
  maxWidth,
  maxHeight,
  preview,
  noMinify,
  sourceMap,
  serve,
  cacheTimeout
}) => {
  if (serve)
    return justServe(serve, cacheTimeout);
  const SOURCE = getPath(source);
  const DEST = dest ? getPath(dest) : join(tmpdir(), 'ucdn');
  const options = {
    createFiles: true,
    maxWidth, maxHeight,
    headers, preview, noMinify, sourceMap
  };
  return (req, res, next) => {
    const path = getURL(req);
    let real = path;
    if (preview)
      real = real.replace(/\.preview(\.jpe?g)$/i, '$1');
    if (sourceMap)
      real = real.replace(/(\.m?js)\.map$/, '$1');
    const original = SOURCE + real;
    stat(original, cacheTimeout).then(
      ({lastModified, size}) => {
        if (path === '/favicon.ico')
          favicon(res, original, size, headers);
        else {
          const {AcceptEncoding, ETag, Since} = getHeaders(req);
          const asset = DEST + compression(path, AcceptEncoding);
          const create = () => {
            const target = DEST + real;
            const waitForIt = target + '.wait';
            const fail = internalServerError.bind(null, res);
            dir(waitForIt, cacheTimeout).then(
              () => {
                pack(asset, original, target, options, cacheTimeout).then(
                  () => {
                    readAndServe(res, asset, cacheTimeout, ETag, fail, false);
                  },
                  /* istanbul ignore next */
                  fail
                );
              },
              /* istanbul ignore next */
              fail
            );
          };
          json(asset, cacheTimeout).then(
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
      fallback(req, res, next)
    );
  };
};
