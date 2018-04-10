/* eslint no-console: 0 */
const _ = require('lodash');
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
app.use(bodyParser.urlencoded({ extended: false}));
app.use(bodyParser.json());

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
// let db;
// const IPFS = require('ipfs');
// const OrbitDB = require('orbit-db');
// const ipfsOptions = {
//   EXPERIMENTAL: {
//     pubsub: true
//   },
// }
// const ipfs = new IPFS(ipfsOptions);

// ipfs.on('ready', async () => {
//   let orbitdb = new OrbitDB(ipfs);
//   try {
//     db = await orbitdb.kvstore('zlto');
//   } catch (e) {
//     console.log('error in creating orbit db: ', e);
//   }
// });
const level = require('level');
var db = level('./mydb');

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

// const experiment = require('./experiment/setup');
// app.get('/runExperiment', async function(req, res) {
//   experiment.generateExperiment(20, 30);
// });

app.delete('/cancelRequest', async function(req, res) {
  if(db) {
    let id = req.param('id');
    db.del(id, function (err) {
      if(err) {
        res.status(500).send({ error: 'error in deleting the request' });
      }
    });
    res.json({'message': `successfully deleted request with id: ${id}`});
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.post('/newRequest', async function(req, res) {
  let newReqObj = {
    requesterID: req.body.id,
    metadata: req.body.metadata,
    evaluations: []
  };
  if(db) {
    await db.put(req.body.id, JSON.stringify(newReqObj));
    res.json({'message': 'successfully stored new request object!', 'storedRequest': newReqObj});
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.get('/checkRequest', async function(req, res) {
  if(db) {
    try {
      let storedRequest = await db.get(req.param('id'), { asBuffer: false });
      if(storedRequest) {
        res.setHeader('Content-Type', 'application/json');
        res.send(storedRequest);
      }
    } catch (e) {
      res.send(e);
    }
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.post('/newEvaluation', async function(req, res) {
  const requesterID = req.body.reqid;
  if(db) {
    try {
      let query = await db.get(requesterID, { asBuffer: false });
      if(query) {
        storedRequest = JSON.parse(query);
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
          // ============  Step 1) Cost Function: calculate stake for the new evaluator ============
          // Vk
          const reputationCommitted = storedEvals.length > 0 
            ? storedEvals
              .map(eval => eval.evaluator.reputationDuring)
              .reduce((a,b) => a + b, 0)
            : 0;

          console.log('reputationCommitted: ', reputationCommitted);
          const { repToBeGained } = storedRequest.metadata; // R
          const STAKE_FRACTION = 0.15; // s (negative slope of rep flow curve)
          newEvaluation.evaluator.stake = (1-reputationCommitted/repToBeGained) * (newEvaluation.evaluator.reputationBefore * STAKE_FRACTION);
          newEvaluation.evaluator.reputationDuring = newEvaluation.evaluator.reputationBefore - newEvaluation.evaluator.stake;
          // Track progress
          storedRequest.reputationProduced = newEvaluation.evaluator.reputationDuring - newEvaluation.evaluator.reputationBefore;

          // ============ Step 2) Rep flow: recalculate rep for committed evaluators ============
          const STAKE_DIST_FRACTION = 0.6; // positive slope of rep flow curve
          
          if (storedEvals.length > 0) {
              // Wk
              const reputationInAgreement = storedEvals.filter(eval => eval.judgment === judgment)
                                                        .map(eval => eval.evaluator.reputationDuring)
                                                        .reduce((a,b) => a + b, 0);
              console.log('reputationInAgreement: ', reputationInAgreement);

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
          // ============ Step 3) Store updated evals ============ 
          storedEvals.push(newEvaluation);
          storedRequest.evaluations = storedEvals;
        }

        try {
          await db.put(requesterID, JSON.stringify(storedRequest));
          // Enough evaluations have come through OR enough reputation has come through:
          // if(storedRequest.evaluations.length == NUM_EVALUATORS_REQUIRED) {
          console.log('reputationProduced: ', storedRequest.reputationProduced);
          
          if(storedRequest.reputationProduced >= storedRequest.metadata.repToBeGained) {
            processEvaluations(storedRequest.evaluations);

            db.del(requesterID, function(err) {
              if (err) console.log('error in deleting the completed evaluation');
            });

            res.json({'message': 'Bounty fulfilled, work asset created, evaluation cycle ended', 'workAsset': storedRequest});
          } else {
            // TODO: Django server will deduct the stake from the evaluator's live reputation
            res.send(storedRequest);
          }
        } catch(e) {
          res.status(500).send({ error: 'error in storing request with updated evaluator' });
        }
      } else {
        res.status(500).send({ error: 'error in obtaining request with specified id' });
      }
    } catch(e) {
      console.log('e: ', e);
      res.status(500).send({ error: 'error in obtaining request with specified id' });
    }
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.listen(port, '0.0.0.0', function onStart(err) {
  if (err) {
    console.log('error on app.listen: ', err);
  }
  console.info('==> 🌎 Listening on port %s. Open up http://0.0.0.0:%s/ in your browser.', port, port);
});
