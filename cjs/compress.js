'use strict';
const ucompress = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('ucompress'));
const umap = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('umap'));

const _ = new Map;
const $ = umap(_);

const clear = asset => {
  _.delete(asset);
};

module.exports = (asset, compress, options, timeout = 1000) => (
  $.get(compress) ||
  $.set(compress, new Promise((res, rej) => {
    ucompress(asset, compress, options).then(
      () => {
        setTimeout(clear, timeout, asset);
        res();
      },
      /* istanbul ignore next */
      () => {
        _.delete(asset);
        rej();
      }
    );
  }))
);
