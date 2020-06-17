const {createWriteStream, statSync} = require('fs');
const {join} = require('path');

const createResponse = callback => {
  const response = createWriteStream(join(__dirname, 'index.test'));
  const operations = [];
  response.writeHead = (...args) => {
    operations.push(args);
  };
  response.end = (...args) => {
    operations.push(args);
    callback(operations);
  };
  return response;
};

const createRequest = url => ({
  url,
  headers: {
    get acceptEncoding() {
      return this['accept-encoding'] || '';
    },
    set acceptEncoding(encoding) {
      this['accept-encoding'] = encoding;
    },
    get ifNoneMatch() {
      return this['if-none-match'] || '';
    },
    set ifNoneMatch(ETag) {
      this['if-none-match'] = ETag;
    },
    get ifModifiedSince() {
      return this['if-modified-since'] || '';
    },
    set ifModifiedSince(value) {
      this['if-modified-since'] = new Date(value).toUTCString();
    }
  }
});

const cdn = require('../cjs');

let requestHandler = cdn({
  source: join(__dirname, 'source'),
  dest: join(__dirname, 'dest'),
  headers: {
    'X-Powered-By': 'µcdn'
  }
});

Promise.resolve('\x1b[1mµcdn\x1b[0m')
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/favicon.ico?whatever';
    requestHandler(
      createRequest(path),
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 200, 'correct code');
        console.assert(headers['Content-Length'] === 16201, 'correct length');
        console.assert(headers['Content-Type'] === 'image/vnd.microsoft.icon', 'correct mime');
        resolve(path);
      })
    );
  }))
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/unknown.file';
    const request = createRequest(path);
    request.headers.acceptEncoding = 'gzip';
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 404, 'correct code');
        console.assert(!headers, 'correct headers');
        resolve(path);
      })
    );
  }))
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/unknown.next';
    const request = createRequest(path);
    request.headers.acceptEncoding = 'gzip';
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 404, 'correct code');
        console.assert(!headers, 'correct headers');
      }),
      () => resolve(path)
    );
  }))
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/text.txt';
    const request = createRequest(path);
    request.headers.acceptEncoding = 'gzip';
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 200, 'correct code');
        console.assert(headers['Content-Length'] === 1363, 'correct length');
        console.assert(headers['Content-Type'] === 'text/plain; charset=UTF-8', 'correct mime');
        console.assert(headers['ETag'] === '"553-Pqern58SsN5hVxit"', 'correct ETag');
        console.assert(headers['X-Powered-By'] === 'µcdn', 'correct headers');
        resolve(path);
      })
    );
  }))
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/text.txt?again';
    const request = createRequest(path);
    request.headers.acceptEncoding = 'gzip';
    request.headers.ifNoneMatch = '"553-Pqern58SsN5hVxit"';
    request.headers.ifModifiedSince = statSync(join(__dirname, 'source', 'text.txt')).mtimeMs;
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 304, 'correct code');
        console.assert(headers['Content-Length'] === 1363, 'correct length');
        console.assert(headers['Content-Type'] === 'text/plain; charset=UTF-8', 'correct mime');
        console.assert(headers['ETag'] === '"553-Pqern58SsN5hVxit"', 'correct ETag');
        console.assert(headers['X-Powered-By'] === 'µcdn', 'correct headers');
        resolve(path);
      })
    );
  }))
  .then(name => {
    requestHandler = cdn({
      maxWidth: 320,
      cacheTimeout: 100,
      source: './test/source',
      preview: true,
      sourceMap: true
    });
    return name;
  })
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/text.txt?one-more-time';
    const request = createRequest(path);
    request.headers.acceptEncoding = 'gzip';
    request.headers.ifNoneMatch = '"553-Pqern58SsN5hVxit"';
    request.headers.ifModifiedSince = (new Date).toISOString();
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 200, 'correct code');
        console.assert(headers['Content-Length'] === 1363, 'correct length');
        console.assert(headers['Content-Type'] === 'text/plain; charset=UTF-8', 'correct mime');
        console.assert(headers['ETag'] === '"553-Pqern58SsN5hVxit"', 'correct ETag');
        console.assert(!headers['X-Powered-By'], 'correct headers');
        resolve(path);
      })
    );
  }))
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/text.txt?last-time-maybe';
    const request = createRequest(path);
    request.headers.acceptEncoding = '';
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 200, 'correct code');
        console.assert(headers['Content-Length'] === 3356, 'correct length');
        console.assert(headers['Content-Type'] === 'text/plain; charset=UTF-8', 'correct mime');
        console.assert(headers['ETag'] === '"d1c-BnkCkKBJ6IhARixM"', 'correct ETag');
        resolve(path);
      })
    );
  }))
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/archibold.preview.jpg';
    const request = createRequest(path);
    request.headers.acceptEncoding = '';
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 200, 'correct code');
        console.assert(headers['Content-Length'] === 685, 'correct length');
        console.assert(headers['Content-Type'] === 'image/jpeg', 'correct mime');
        console.assert(headers['ETag'] === '"2ad-3mnI/A3xlg3wSqdM"', 'correct ETag');
        resolve(path);
      })
    );
  }))
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/archibold.jpg';
    const request = createRequest(path);
    request.headers.acceptEncoding = '';
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 200, 'correct code');
        console.assert(headers['Content-Length'] === 4824, 'correct length');
        console.assert(headers['Content-Type'] === 'image/jpeg', 'correct mime');
        console.assert(headers['ETag'] === '"12d8-iQ9LCsVs0hfWT+nl"', 'correct ETag');
        resolve(path);
      })
    );
  }))
  .then(name => {
    requestHandler = cdn({
      maxHeight: 320,
      cacheTimeout: 0,
      source: './test/source'
    });
    return name;
  })
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/index.html';
    const request = createRequest(path);
    request.headers.acceptEncoding = 'br';
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 200, 'correct code');
        console.assert(headers['Content-Length'] === 84, 'correct length');
        console.assert(headers['Content-Type'] === 'text/html; charset=UTF-8', 'correct mime');
        console.assert(headers['ETag'] === '"54-jtoG/c9bRSWQB+gy"', 'correct ETag');
        resolve(path);
      })
    );
  }))
  .then(name => new Promise(resolve => {
    console.log(name);
    const path = '/benja-dark.svg';
    const request = createRequest(path);
    request.headers.acceptEncoding = '';
    let i = 0;
    const done = () => {
      if (++i === 2)
        resolve(path);
    };
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 200, 'correct code');
        console.assert(headers['Content-Length'] === 2478, 'correct length');
        console.assert(headers['Content-Type'] === 'image/svg+xml', 'correct mime');
        console.assert(headers['ETag'] === '"9ae-WAa0uuWT+I9+hj77"', 'correct ETag');
        done();
      })
    );
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 200, 'correct code');
        console.assert(headers['Content-Length'] === 2478, 'correct length');
        console.assert(headers['Content-Type'] === 'image/svg+xml', 'correct mime');
        console.assert(headers['ETag'] === '"9ae-WAa0uuWT+I9+hj77"', 'correct ETag');
        done();
      })
    );
  }))
  .then(name => new Promise(resolve => {
    console.log(name);
    requestHandler = cdn({serve: './test/dest'});
    const path = '/text.txt';
    const request = createRequest(path);
    request.headers.acceptEncoding = 'deflate';
    request.headers.ifNoneMatch = '"547-MRRsLNkHQ2IWwyfp"';
    requestHandler(
      request,
      createResponse(operations => {
        console.assert(operations.length === 2, 'correct amount of operations');
        const [code, headers] = operations.shift();
        const content = operations.shift();
        console.assert(content.length < 1, 'correct content');
        console.assert(code === 304, 'correct code');
        console.assert(headers['Content-Length'] === 1351, 'correct length');
        console.assert(headers['Content-Type'] === 'text/plain; charset=UTF-8', 'correct mime');
        console.assert(headers['ETag'] === '"547-MRRsLNkHQ2IWwyfp"', 'correct ETag');
        console.assert(headers['X-Powered-By'] === 'µcdn', 'correct headers');
        resolve(path);
      })
    );
  }))
  .then(console.log)
;
