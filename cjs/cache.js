'use strict';
const {mkdir, readFile, stat: fStat} = require('fs');
const {dirname} = require('path');

const idPromise = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('id-promise'));
const ucompress = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('ucompress'));
const umap = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('umap'));

const {parse} = JSON;

const _dir = new Map;
const _json = new Map;
const _pack = new Map;
const _stat = new Map;

const $dir = umap(_dir);
const $json = umap(_json);
const $stat = umap(_stat);

const clear = (map, asset) => {
  map.delete(asset);
};

const create = (timer, callback) => ({
  timer,
  promise: new Promise(callback)
});

const dir = (asset, timeout = 1000) => (
  $dir.get(asset) || $dir.set(asset, create(
    timeout && setTimeout(clear, timeout, _dir, asset),
    (res, rej) => {
      mkdir(dirname(asset), {recursive: true}, err => {
        /* istanbul ignore if */
        if (err) {
          clearTimeout(_dir.get(asset).timer);
          _dir.delete(asset);
          rej(err);
        }
        else
          res();
      });
    }
  ))
).promise;
exports.dir = dir;

const json = (asset, timeout = 1000) => (
  $json.get(asset) || $json.set(asset, create(
    timeout && setTimeout(clear, timeout, _json, asset),
    (res, rej) => {
      readFile(asset + '.json', (err, data) => {
        err ? rej(err) : res(parse(data));
      });
    }
  ))
).promise;
exports.json = json;

const pack = (asset, source, target, options, timeout = 1000) => {
  if (_pack.has(target))
    return _pack.get(target);
  /* istanbul ignore next */
  if (_json.has(asset))
    clearTimeout(_json.get(asset).timer);
  const promise = idPromise(`ucdn:pack:${target}`, (res, rej) => {
    ucompress(source, target, options).then(
      () => {
        if (timeout)
          setTimeout(clear, timeout, _pack, target);
        _json.delete(asset);
        res(json(asset, timeout));
      },
      /* istanbul ignore next */
      err => {
        _pack.delete(target);
        _json.delete(asset);
        console.error(`\x1b[1m\x1b[31mError\x1b[0m ${source}`);
        console.error(err);
        rej(err);
      }
    );
  });
  _pack.set(target, promise);
  _json.set(asset, promise);
  return promise;
};
exports.pack = pack;

const stat = (asset, timeout = 1000) => (
  $stat.get(asset) || $stat.set(asset, create(
    timeout && setTimeout(clear, timeout, _stat, asset),
    (res, rej) => {
      fStat(asset, (err, stats) => {
        if (err || !stats.isFile()) {
          clearTimeout(_stat.get(asset).timer);
          _stat.delete(asset);
          rej(err);
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
