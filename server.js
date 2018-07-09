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

const asyncMiddleware = fn =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
  };


// BigChainDB
const BigchainDB = require('bigchaindb-driver')
const bip39 = require('bip39')

const API_PATH = 'https://test.bigchaindb.com/api/v1/'
const conn = new BigchainDB.Connection(API_PATH, {
    app_id: '67c1df20',
    app_key: '4d9eb456e2289da3d2706eeca56d439f'
})
const gateway = new BigchainDB.Ed25519Keypair(bip39.mnemonicToSeed('seedPhrase').slice(0,32))


async function finalizeWorkAsset(data) {
  console.log('processing evals with data: ', data)
  //TODO:   add finalized work asset into a store that expires every week. 
  // expose endpoint for Django to pull down from.
  const txCreateWorkAsset = BigchainDB.Transaction.makeCreateTransaction(
    {
      data, 
    },
    {
      datetime: new Date().toString(),
      synced_from: 'Zlto NodeEval Server',
    },
    [BigchainDB.Transaction.makeOutput(BigchainDB.Transaction.makeEd25519Condition(gateway.publicKey))],
    gateway.publicKey
  )

  const txSigned = BigchainDB.Transaction.signTransaction(txCreateWorkAsset, gateway.publicKey)

  try {
    await conn.postTransactionCommit(txSigned)

    const storedAssets = await conn.searchAssets('Toby')
    console.log('storedAssets: ', JSON.stringify(storedAssets))
  } catch(e) {
    console.log(e)
  }
}

function normalizeRep(data) {
  let weightedDecision = 0;

  _.forEach(data.evaluations, eval => {
    const { reputationBefore, reputationDuring } = eval.evaluator;
    const repDiff = reputationDuring - reputationBefore;

    if(repDiff < 0) {
      // if lost rep, set it back to 0
      eval.evaluator.finalRepGained = 0;
    } else {
      const normalizedRep = (repDiff / data.reputationProduced) * data.metadata.repToBeGained;
      eval.evaluator.finalRepGained = normalizedRep;
    }

    weightedDecision += (eval.evaluator.finalRepGained * eval.judgment)
    console.log(`Final reputation for ${eval.evaluator.name}: ${eval.evaluator.finalRepGained}`);
  });

  // set these two fields equal for consistency
  data.metadata.reputationProduced = data.metadata.repToBeGained;
  data.metadata.finalJudgment = Math.round(weightedDecision / data.reputationProduced);
  return data;
}

// LevelDB to store intermediate states of evaluation cycles
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
    res.json({'message': 'success'});
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.post('/newRequest', async function(req, res) {
  let newReqObj = {
    id: req.body.id,
    requesterId: req.body.requesterId,
    metadata: req.body.metadata,
    evaluations: []
  };
  if(db) {
    await db.put(req.body.id, JSON.stringify(newReqObj));
    res.json({'message': 'success', 'storedRequest': newReqObj});
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
        res.send({'message': 'success', 'storedRequest': JSON.parse(storedRequest)});
      }
    } catch (e) {
      res.send(e);
    }
  } else {
    res.status(500).send({ error: 'no db instance' });
  }
});

app.post('/newEvaluation', async function(req, res) {
  const requestId = req.body.id;
  if(db) {
    try {
      let query = await db.get(requestId, { asBuffer: false });
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
          let repGained = storedEvals.length > 0 
            ? storedEvals
              .map(eval => (eval.evaluator.reputationDuring - eval.evaluator.reputationBefore))
              .reduce((a,b) => a + b, 0)
            : 0;

          console.log('repGained: ', repGained);
          repGained = repGained < 0 ? 0 : repGained;

          const { repToBeGained } = storedRequest.metadata; // R
          const STAKE_FRACTION = 0.10; // s (negative slope of rep flow curve)
          const { reputationBefore } = newEvaluation.evaluator;
          const stake = (1-repGained/repToBeGained) * (reputationBefore * STAKE_FRACTION);

          // never let stake exceed how much rep they have (leads to negative  reputationDuring)
          newEvaluation.evaluator.stake = stake > reputationBefore ? reputationBefore : stake;
          newEvaluation.evaluator.reputationDuring = reputationBefore - newEvaluation.evaluator.stake;

          const repDiff = newEvaluation.evaluator.reputationDuring - newEvaluation.evaluator.reputationBefore;
          storedRequest.reputationProduced = repDiff > 0 ? repDiff : 0; 

          // ============ Step 2) Rep flow: recalculate rep for committed evaluators ============
          const STAKE_DIST_FRACTION = 0.6; // positive slope of rep flow curve
          
          if (storedEvals.length > 0) {
              // Wk
              const reputationInAgreement = storedEvals
                .filter(eval => eval.judgment === judgment)
                .map(eval => eval.evaluator.reputationDuring)
                .reduce((a,b) => a + b, 0);
              console.log('reputationInAgreement: ', reputationInAgreement);

              storedEvals.forEach(eval => {
              const agreesWithCurrent = eval.judgment === newEvaluation.judgment;
              if(agreesWithCurrent) {
                const repayment = STAKE_DIST_FRACTION * eval.evaluator.reputationDuring * newEvaluation.evaluator.reputationDuring / reputationInAgreement;
                console.log('repayment: ', repayment);
                eval.evaluator.reputationDuring += repayment;
              }
              // Track progress
              const repDiff = eval.evaluator.reputationDuring - eval.evaluator.reputationBefore;
              storedRequest.reputationProduced += repDiff > 0 ? repDiff : 0;
            });
          }
          // ============ Step 3) Store updated evals ============ 
          storedEvals.push(newEvaluation);
          storedRequest.evaluations = storedEvals;
        }

        try {
          await db.put(requestId, JSON.stringify(storedRequest));
          // Enough evaluations have come through OR enough reputation has come through:
          // if(storedRequest.evaluations.length == NUM_EVALUATORS_REQUIRED) {
          console.log('reputationProduced: ', storedRequest.reputationProduced);
          
          if(storedRequest.reputationProduced >= storedRequest.metadata.repToBeGained) {
            storedRequest = normalizeRep(storedRequest);
            finalizeWorkAsset(storedRequest);
            console.log('requestId: ', requestId);
            db.del(requestId, function(err) {
              if (err) console.log('error in deleting the completed evaluation');
            });
            
            res.json({'message': 'success', 'details': 'evaluation cycle completed, workAsset finalized', 'workAsset': storedRequest});
          } else {
            // TODO: Django server will deduct the stake from the evaluator's live reputation
            res.send({'message': 'success', storedRequest});
          }
        } catch(e) {
          res.status(500).send({ error: 'error in storing request with updated evaluator', msg: e });
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
