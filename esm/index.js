import {tmpdir} from 'os';
import {join} from 'path';
import {performance} from 'perf_hooks';

import {log} from 'essential-md';

import {
  compression, fallback, favicon, json,
  serve as justServe, serveFile,
  getHeaders, getPath, getURL
} from 'ucdn-utils';

import {dir, pack, stat} from './cache.js';

const {floor} = Math;

/* istanbul ignore next */
const assetName = asset => {
  if (/\.(br|gzip|deflate)$/.test(asset)) {
    const {$1} = RegExp;
    return '`' + asset.slice(0, -($1.length + 1)) + '`-.' + $1 + '-';
  }
  return '`' + asset + '`';
};

/* istanbul ignore next */
const internalServerError = res => {
  res.writeHead(500);
  res.end();
};

/* istanbul ignore next */
const noPreview = (_, md, jpg) => (md === '.md' ? md : jpg);

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
  cacheTimeout,
  verbose
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
      real = real.replace(/(\.md)?\.preview(\.(?:jpe?g|html))$/i, noPreview);
    if (sourceMap)
      real = real.replace(/(\.m?js)\.(?:source\1|map)$/, '$1');
    const original = SOURCE + real;
    stat(original, cacheTimeout).then(
      ({lastModified, size}) => {
        if (path === '/favicon.ico') {
          /* istanbul ignore if */
          if (verbose)
            log(` *200* -favicon- ${original}`);
          favicon(res, original, size, headers);
        }
        else {
          const {AcceptEncoding, ETag, Since} = getHeaders(req);
          const asset = DEST + compression(path, AcceptEncoding);
          const create = (time) => {
            const target = DEST + real;
            const waitForIt = target + '.wait';
            /* istanbul ignore next */
            const fail = () => {
              if (verbose)
                log(` *500* ${assetName(asset)}`);
              internalServerError(res);
            };
            dir(waitForIt, cacheTimeout).then(
              () => {
                pack(asset, original, target, options, cacheTimeout).then(
                  () => {
                    /* istanbul ignore if */
                    if (verbose) {
                      if (time)
                        time = floor(performance.now() - time);
                      log(` *200* ${time ? `-${time}ms- ` : ''}${assetName(asset)}`);
                    }
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
              if (lastModified === headers['Last-Modified']) {
                /* istanbul ignore if */
                if (verbose)
                  log(` *304* ${assetName(asset)}`);
                serveFile(res, asset, headers, ETag, lastModified === Since);
              }
              else
                create(0);
            },
            () => {
              /* istanbul ignore next */
              create(verbose ? performance.now() : 0);
            }
          );
        }
      },
      fallback(req, res, next)
    );
  };
};
