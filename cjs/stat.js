'use strict';
const {stat} = require('fs');

const umap = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('umap'));

const _ = new Map;
const $ = umap(_);

const clear = asset => {
  _.delete(asset);
};

module.exports = (asset, timeout = 1000) => (
  $.get(asset) ||
  $.set(asset, new Promise((res, rej) => {
    stat(asset, (err, stats) => {
      if (err || !stats.isFile()) {
        _.delete(asset);
        rej();
      }
      else {
        setTimeout(clear, timeout, asset);
        res({
          lastModified: new Date(stats.mtimeMs).toUTCString(),
          size: stats.size
        });
      }
    });
  }))
);
