/* eslint no-console: 0 */

const path = require('path');
const express = require('express');
const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const config = require('./webpack.config.js');
const _ = require('lodash');

const isDeveloping = process.env.NODE_ENV !== 'production';
const port = isDeveloping ? 3000 : process.env.PORT;
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

const NUM_EVALUATORS_REQUIRED = 3;

function processEvaluations(evaluations) {
  //TODO: initiateReputationFlow, createWorkAsset, submitAssetToCentral, submitAssetToChain
  _.forEach(evaluations, eval => {
    console.log(`Reputation for ${eval.evaluator.name}: ${eval.evaluator.reputationBefore}`);
  });
}

const asyncMiddleware = fn =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
  };

// ========== configure IPFS/Orbit ========== //
let db;
const IPFS = require('ipfs');
const OrbitDB = require('orbit-db');
const ipfsOptions = {
  EXPERIMENTAL: {
    pubsub: true
  },
}
const ipfs = new IPFS(ipfsOptions);

ipfs.on('ready', async () => {
  let orbitdb = new OrbitDB(ipfs);
  try {
    db = await orbitdb.kvstore('zlto');
  } catch (e) {
    console.log('error in creating orbit db: ', e);
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
  let newReqObj = {
    requesterID: req.body.id,
    metadata: req.body.metadata,
    evaluations: []
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
    if(storedRequest) {
      res.send(storedRequest);
    } else {
      res.send('no request matching specified id');
    }
  } else {
    res.send('no db instance');
  }
});

app.post('/newEvaluation', async function(req, res) {
  const requesterID = req.body.reqid;
  if(db) {
    try {
      const storedRequest = await db.get(requesterID);

      if (storedRequest) {
        const storedEvals = storedRequest.evaluations;
        const evaluatorExists = _.find(storedEvals, eval => eval.evaluator.id === req.body.evaluator.id);

        if(!_.isUndefined(evaluatorExists)) { // this evaluator has already evaluated
          evaluatorExists.judgment = req.body.judgment;
        } else {
          const newEvaluation = {
            //TODO: add timestamp
            evaluator: req.body.evaluator,
            judgment: req.body.judgment
          };
          storedEvals.push(newEvaluation);
          storedRequest.evaluations = storedEvals;
        }

        try {
          await db.put(requesterID, storedRequest);

          // Enough evaluations have come through
          if(storedRequest.evaluations.length == NUM_EVALUATORS_REQUIRED) {
            processEvaluations(storedRequest.evaluations);
            res.send('Evaluation fulfilled, cleared in orbitDB, ready for on-chain sync');
          } else {
            res.send(storedRequest);
          }
        } catch(e) {
          res.send('error in storing request with updated evaluator: ', e);
        }
      } else {
        res.send('no request matching specified id');
      }
    } catch(e) {
      res.send('error in obtaining request with specified id: ', e);
    }
  } else {
    res.send('no db instance');
  }
});

app.listen(port, '0.0.0.0', function onStart(err) {
  if (err) {
    console.log(err);
  }
  console.info('==> 🌎 Listening on port %s. Open up http://0.0.0.0:%s/ in your browser.', port, port);
});
