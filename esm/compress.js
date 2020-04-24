import ucompress from 'ucompress';
import umap from 'umap';

const _ = new Map;
const $ = umap(_);

const clear = asset => {
  _.delete(asset);
};

export default (asset, compress, options, timeout = 1000) => (
  $.get(asset) ||
  $.set(asset, new Promise((res, rej) => {
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
