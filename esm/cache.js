import {readFile, stat as fStat} from 'fs';

import ucompress from 'ucompress';
import umap from 'umap';

const {parse} = JSON;

const _json = new Map;
const _pack = new Map;
const _stat = new Map;

const $json = umap(_json);
const $stat = umap(_stat);

const clear = (map, asset) => {
  map.delete(asset);
};

const create = (timer, callback) => ({
  timer,
  promise: new Promise(callback)
});

export const json = (asset, timeout = 1000) => (
  $json.get(asset) || $json.set(asset, create(
    timeout && setTimeout(clear, timeout, _json, asset),
    (res, rej) => {
      readFile(asset + '.json', (err, data) => {
        err ? rej(err) : res(parse(data));
      });
    }
  ))
).promise;

export const pack = (asset, source, target, options, timeout = 1000) => {
  if (_pack.has(target))
    return _pack.get(target);
  /* istanbul ignore next */
  if (_json.has(asset))
    clearTimeout(_json.get(asset).timer);
  const promise = ucompress(source, target, options).then(
    () => {
      if (timeout)
        setTimeout(clear, timeout, _pack, target);
      _json.delete(asset);
      return json(asset, timeout);
    },
    /* istanbul ignore next */
    err => {
      _pack.delete(target);
      _json.delete(asset);
      return Promise.reject(err);
    }
  );
  _pack.set(target, promise);
  _json.set(asset, promise);
  return promise;
};

export const stat = (asset, timeout = 1000) => (
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
