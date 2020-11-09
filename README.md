# Zlto p2p Evaluation Protocol
A node server for p2p evaluation of work. Primarily for performance comparisons against decentralized smart contract.

**NOTE!** Use the Node 9.x.x.
## Install and Running
0. clone this repo
1. npm install
2. npm start
3. navigate to http://localhost:3000 in your browser of choice.


## API

### POST /newRequest
Example Body:
```JavaScript
{
	"id": 460,
	"metadata": {
		"type": "educational",
		"numHours": 25,
		"repToBeGained": 500
	}
}

```
Response:
```JavaScript
{
    "message": "successfully stored new request object!",
    "storedRequest": {
        "requesterID": 450,
        "metadata": {
            "type": "educational",
            "numHours": 25,
            "repToBeGained": 300
        },
        "evaluations": []
    }
}
```

### GET /checkRequest
Params:
- id: the id of the request object 
Response:
```JavaScript
{
    "requesterID": 460,
    "metadata": {
        "type": "educational",
        "numHours": 25,
        "repToBeGained": 500
    },
    "evaluations": []
}
```
### POST /newEvaluation
Example Body:
```JavaScript
{
	"reqid": 460,
	"evaluator": {
		"name": "gu", 
		"id": 101, 
		"reputationBefore": 300
	},
	"judgment": false
}

```
Response (once evaluation cycle ends):
```JavaScript
{
    "message": "success",
    "details": "evaluation cycle completed, workAsset finalized",
    "workAsset": {
        "id": 450,
        "requesterId": 2,
        "metadata": {
            "type": "educational",
            "numHours": 25,
            "repToBeGained": 100
        },
        "evaluations": [
            {
                "evaluator": {
                    "name": "Kurt",
                    "id": 355,
                    "reputationBefore": 150,
                    "stake": 15,
                    "reputationDuring": 267.3337849740933,
                    "finalRepGained": 88.44299592517545
                },
                "judgment": true
            },
            {
                "evaluator": {
                    "name": "Allan",
                    "id": 315,
                    "reputationBefore": 150,
                    "stake": 17.25,
                    "reputationDuring": 165.33221502590675,
                    "finalRepGained": 11.557004074824553
                },
                "judgment": true
            },
            {
                "evaluator": {
                    "name": "Marlon",
                    "id": 317,
                    "reputationBefore": 150,
                    "stake": 7.890000000000001,
                    "reputationDuring": 142.11,
                    "finalRepGained": 0
                },
                "judgment": true
            }
        ],
        "reputationProduced": 100
    }
}
```




### React by default
The project runs with React by default and hot replacement of changes to the modules. Currently it is on 0.14.3.

### CSS Modules
CSS files loaded into components are locally scoped and you can point to class names with javascript. You can also compose classes together, also from other files. These are also hot loaded. Read more about them [here](http://glenmaddern.com/articles/css-modules).

To turn off CSS Modules remove it from the `webpack.config.js` file.

### Babel and Linting
Both Node server and frontend code runs with Babel. And all of it is linted. With atom you install the `linter` package, then `linter-eslint` and `linter-jscs`. You are covered. Also run `npm run eslint` or `npm run jscs` to verify all files. I would recommend installing `language-babel` package too for syntax highlighting
