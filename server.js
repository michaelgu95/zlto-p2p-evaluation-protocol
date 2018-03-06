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
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// const NUM_EVALUATORS_REQUIRED = 10;

function processEvaluations(evaluations) {
  //TODO: createWorkAsset, submitAssetToCentral, submitAssetToChain
  _.forEach(evaluations, eval => {
    console.log(`Reputation for ${eval.evaluator.name}: ${eval.evaluator.reputationDuring}`);
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
  if(db) {
    await db.put(req.body.id, newReqObj);
    res.send('successfully stored new request object!');
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
      if(storedRequest) {
        const storedEvals = storedRequest.evaluations;
        const evaluatorExists = _.find(storedEvals, eval => eval.evaluator.id === req.body.evaluator.id);
        const { judgment, evaluator } = req.body

        if(!_.isUndefined(evaluatorExists)) { // this evaluator has already evaluated
          evaluatorExists.judgment = judgment;
        } else {
          const newEvaluation = {
            //TODO: add timestamp
            evaluator,
            judgment
          };
          // ============  1) Cost Function: calculate stake for the new evaluator ============
          // Vk
          const reputationCommitted = storedEvals.length > 0 
            ? storedEvals
              .map(eval => eval.evaluator.reputationDuring)
              .reduce((a,b) => a + b, 0)
            : 0;

          console.log('reputationCommitted: ', reputationCommitted);
          // R
          const { repToBeGained } = storedRequest.metadata;
          // s
          const STAKE_FRACTION = 0.15; // negative slope of rep flow curve

          newEvaluation.evaluator.stake = (1-reputationCommitted/repToBeGained) * (newEvaluation.evaluator.reputationBefore * STAKE_FRACTION);
          newEvaluation.evaluator.reputationDuring = newEvaluation.evaluator.reputationBefore - newEvaluation.evaluator.stake;
  
          // Track progress
          storedRequest.reputationProduced = newEvaluation.evaluator.reputationDuring - newEvaluation.evaluator.reputationBefore;

          // ============ 2) Rep flow: recalculate rep for committed evaluators ============
          const STAKE_DIST_FRACTION = 0.6; // positive slope of rep flow curve
          // Wk
          const reputationInAgreement = storedEvals.length > 0 
            ? storedEvals
              .filter(eval => eval.judgment === judgment)
              .map(eval => eval.evaluator.reputationDuring)
              .reduce((a,b) => a + b, 0)
            : 0;

          console.log('reputationInAgreement: ', reputationInAgreement);

          if (storedEvals.length > 0) {
              storedEvals.forEach(eval => {
              const agreesWithCurrent = eval.judgment === newEvaluation.judgment;
              if(agreesWithCurrent) {
                eval.evaluator.reputationDuring += (STAKE_DIST_FRACTION 
                                                    * eval.evaluator.reputationDuring 
                                                    * newEvaluation.evaluator.reputationDuring 
                                                    / reputationInAgreement);

              }
             // Track progress
              storedRequest.reputationProduced += eval.evaluator.reputationDuring - eval.evaluator.reputationBefore;
            });
          }
          // ============ 3) Store updated evals ============ 
          storedEvals.push(newEvaluation);
          storedRequest.evaluations = storedEvals;
        }

        try {
          await db.put(requesterID, storedRequest);
          // Enough evaluations have come through OR enough reputation has come through:
          // if(storedRequest.evaluations.length == NUM_EVALUATORS_REQUIRED) {
          console.log('reputationProduced: ', storedRequest.reputationProduced);
          
          if(storedRequest.reputationProduced >= storedRequest.metadata.repToBeGained) {
            processEvaluations(storedRequest.evaluations);
            res.send('Evaluation fulfilled, cleared in orbitDB, ready for on-chain sync');
          } else {
            // TODO: Django server will deduct the stake from the evaluator's live reputation
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
    console.log('error on app.listen: ', err);
  }
  console.info('==> 🌎 Listening on port %s. Open up http://0.0.0.0:%s/ in your browser.', port, port);
});
