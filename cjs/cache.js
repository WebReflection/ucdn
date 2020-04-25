'use strict';
const {readFile, stat: fStat} = require('fs');

const ucompress = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('ucompress'));
const umap = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('umap'));

const {parse} = JSON;

const _json = new Map;
const _pack = new Map;
const _stat = new Map;

const $pack = umap(_pack);
const $stat = umap(_stat);

const clear = (map, asset) => {
  map.delete(asset);
};

const json = (asset, timeout = 1000) => {
  let details = _json.get(asset);
  if (!details)
    _json.set(asset, details = {
      timer: 0,
      promise: new Promise((res, rej) => {
        readFile(asset + '.json', (err, data) => {
          if (timeout)
            details.timer = setTimeout(clear, timeout, _json, asset);
          if (err)
            rej();
          else
            res(parse(data));
        });
      })
    });
  return details.promise;
};
exports.json = json;

const pack = (asset, source, target, options, timeout = 1000) => (
  $pack.get(target) ||
  $pack.set(target, new Promise((res, rej) => {
    /* istanbul ignore next */
    if (_json.has(asset))
      clearTimeout(_json.get(asset).timer);
    _json.set(asset, {
      promise: new Promise(($, _) => {
        const resolve = () => {
          _json.delete(asset);
          json(asset, timeout).then($, _);
        };
        ucompress(source, target, options).then(
          () => {
            if (timeout)
              setTimeout(clear, timeout, _pack, target);
            res();
            resolve();
          },
          /* istanbul ignore next */
          () => {
            _pack.delete(target);
            rej();
            resolve();
          }
        );
      })
    });
  }))
);
exports.pack = pack;

const stat = (asset, timeout = 1000) => (
  $stat.get(asset) ||
  $stat.set(asset, new Promise((res, rej) => {
    fStat(asset, (err, stats) => {
      if (err || !stats.isFile()) {
        _stat.delete(asset);
        rej();
      }
      else {
        if (timeout)
          setTimeout(clear, timeout, _stat, asset);
        res({
          lastModified: new Date(stats.mtimeMs).toUTCString(),
          size: stats.size
        });
      }
    });
  }))
);
exports.stat = stat;
