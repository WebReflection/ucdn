import {mkdir, stat as fStat} from 'fs';
import {dirname} from 'path';

import idPromise from 'id-promise';
import ucompress from 'ucompress';
import umap from 'umap';
import {clear, create, json, _json} from 'ucdn-utils';

const _dir = new Map;
const _pack = new Map;
const _stat = new Map;

const $dir = umap(_dir);
const $stat = umap(_stat);

export const dir = (asset, timeout = 1000) => (
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

export const pack = (asset, source, target, options, timeout = 1000) => {
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
        json(asset, timeout).then(res, rej);
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
