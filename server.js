/* eslint no-console: 0 */

const path = require('path');
const express = require('express');
const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const config = require('./webpack.config.js');

const isDeveloping = process.env.NODE_ENV !== 'production';
const port = isDeveloping ? 3000 : process.env.PORT;
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());


const asyncMiddleware = fn =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
  };

const ipfsOptions = {
  EXPERIMENTAL: {
    pubsub: true
  },
}

let db;
const IPFS = require('ipfs');
const OrbitDB = require('orbit-db');
const ipfs = new IPFS(ipfsOptions);

ipfs.on('ready', async () => {
  let orbitdb = new OrbitDB(ipfs);
  try {
    db = await orbitdb.kvstore('profile');
  } catch (e) {
    console.log(e);
  }
});


if (isDeveloping) {
  const compiler = webpack(config);
  const middleware = webpackMiddleware(compiler, {
    publicPath: config.output.publicPath,
    contentBase: 'src',
    stats: {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false
    }
  });

  app.use(middleware);
  app.use(webpackHotMiddleware(compiler));
  // app.get('*', function response(req, res) {
  //   res.write(middleware.fileSystem.readFileSync(path.join(__dirname, 'dist/index.html')));
  //   res.end();
  // });
} else {
  app.use(express.static(__dirname + '/dist'));
  // app.get('*', function response(req, res) {
  //   res.sendFile(path.join(__dirname, 'dist/index.html'));
  // });
}

app.post('/newRequest', async function(req, res) {
  newReqObj = {
    requesterID: req.body.id,
    metadata: req.body.metadata
  };
  console.log('newReqObj: ', newReqObj);

  if(db) {
    await db.put(req.body.id, newReqObj);
    res.send('success')
  } else {
    res.send('no db instance');
  }
});

app.get('/checkRequest', async function(req, res) {
  if(db) {
    let storedRequest = await db.get(req.param('id'));
    res.send(storedRequest);
  }
});

app.listen(port, '0.0.0.0', function onStart(err) {
  if (err) {
    console.log(err);
  }
  console.info('==> 🌎 Listening on port %s. Open up http://0.0.0.0:%s/ in your browser.', port, port);
});
