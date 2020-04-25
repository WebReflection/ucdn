'use strict';
const {readFile, stat: fStat} = require('fs');

const ucompress = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('ucompress'));
const umap = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('umap'));

const {parse} = JSON;

const _json = new Map;
const _pack = new Map;
const _stat = new Map;

const $json = umap(_json);
const $pack = umap(_pack);
const $stat = umap(_stat);

const clear = (map, asset) => {
  map.delete(asset);
};

const create = (timer, callback) => ({
  timer,
  promise: new Promise(callback)
});

const json = (asset, timeout = 1000) => (
  $json.get(asset) || $json.set(asset, create(
    timeout && setTimeout(clear, timeout, _json, asset),
    (res, rej) => {
      readFile(asset + '.json', (err, data) => {
        err ? rej() : res(parse(data));
      });
    }
  ))
).promise;
exports.json = json;

const pack = (asset, source, target, options, timeout = 1000) => (
  $pack.get(target) ||
  $pack.set(target, new Promise((res, rej) => {
    /* istanbul ignore next */
    if (_json.has(asset))
      clearTimeout(_json.get(asset).timer);
    _json.set(asset, create(0, ($, _) => {
      const next = () => {
        _json.delete(asset);
        json(asset, timeout).then($, _);
      };
      ucompress(source, target, options).then(
        () => {
          if (timeout)
            setTimeout(clear, timeout, _pack, target);
          res();
          next();
        },
        /* istanbul ignore next */
        () => {
          _pack.delete(target);
          rej();
          next();
        }
      );
    }));
  }))
);
exports.pack = pack;

const stat = (asset, timeout = 1000) => (
  $stat.get(asset) || $stat.set(asset, create(
    timeout && setTimeout(clear, timeout, _stat, asset),
    (res, rej) => {
      fStat(asset, (err, stats) => {
        if (err || !stats.isFile()) {
          clearTimeout(_stat.get(asset).timer);
          _stat.delete(asset);
          rej();
        }
        else
          res({
            lastModified: new Date(stats.mtimeMs).toUTCString(),
            size: stats.size
          });
      });
    }
  ))
).promise;
exports.stat = stat;
