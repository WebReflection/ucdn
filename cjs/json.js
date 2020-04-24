'use strict';
const {readFile} = require('fs');

const umap = (m => m.__esModule ? /* istanbul ignore next */ m.default : /* istanbul ignore next */ m)(require('umap'));

const {parse} = JSON;

const _ = new Map;
const $ = umap(_);

const clear = asset => {
  _.delete(asset);
};

module.exports = (asset, timeout = 1000) => (
  $.get(asset) ||
  $.set(asset, new Promise((res, rej) => {
    readFile(asset + '.json', (err, data) => {
      if (err) {
        _.delete(asset);
        rej();
      }
      else {
        res(parse(data));
        setTimeout(clear, timeout, asset);
      }
    });
  }))
);
