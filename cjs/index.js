'use strict';
const {createReadStream, unlink} = require('fs');
const {tmpdir} = require('os');
const {extname, join, resolve} = require('path');
const ucompress = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('ucompress'));

const {dir, json, pack, stat} = require('./cache.js');

const {compressed} = ucompress;

const compression = (path, AcceptEncoding) => {
  if (compressed.has(extname(path).toLowerCase())) {
    switch (true) {
      case /\bbr\b/.test(AcceptEncoding):
        return path + '.br';
      case /\bgzip\b/.test(AcceptEncoding):
        return path + '.gzip';
      case /\bdeflate\b/.test(AcceptEncoding):
        return path + '.deflate';
    }
  }
  return path;
};

const getHeaders = ({headers}) => {
  const {
    ['accept-encoding']: AcceptEncoding,
    ['if-none-match']: ETag,
    ['if-modified-since']: Since
  } = headers;
  return {AcceptEncoding, ETag, Since};
};
const getPath = source => (source[0] === '/' ? source : resolve(source));
const getURL = ({url}) => decodeURIComponent(url.replace(/\?.*$/, ''));

const fallback = (req, res, next) => () => {
  if (next)
    next(req, res);
  else {
    res.writeHead(404);
    res.end();
  }
};

const favicon = (res, original, size, headers) => {
  streamFile(res, original, {
    'Content-Length': size,
    'Content-Type': 'image/vnd.microsoft.icon',
    ...headers
  });
};

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

module.exports = ({
  source,
  dest,
  headers,
  maxWidth,
  maxHeight,
  preview,
  serve,
  cacheTimeout: CT
}) => {
  const SOURCE = getPath(serve || source);
  if (serve)
    return (req, res, next) => {
      const {AcceptEncoding, ETag} = getHeaders(req);
      const asset = SOURCE + compression(getURL(req), AcceptEncoding);
      json(asset, CT).then(
        headers => {
          serveFile(res, asset, headers, ETag, true);
        },
        fallback(req, res, next)
      );
    };
  const DEST = dest ? getPath(dest) : join(tmpdir(), 'ucdn');
  const options = {createFiles: true, maxWidth, maxHeight, headers, preview};
  return (req, res, next) => {
    const path = getURL(req);
    const real = preview ? path.replace(/\.preview(\.jpe?g)$/i, '$1') : path;
    const original = SOURCE + real;
    stat(original, CT).then(
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
            dir(waitForIt, CT).then(
              () => {
                pack(asset, original, target, options, CT).then(
                  () => {
                    readAndServe(res, asset, CT, ETag, fail, false);
                  },
                  /* istanbul ignore next */
                  fail
                );
              },
              /* istanbul ignore next */
              fail
            );
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
      fallback(req, res, next)
    );
  };
};
