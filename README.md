# p2pEvalNode
A node server for p2p evaluation of work. Primarily for performance comparisons against decentralized smart contract.

**NOTE!** Use the latest version of Node, 9.x.x.

## Install and Running
`git clone https://github.com/christianalfoni/webpack-express-boilerplate.git`

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
successfully stored new request object!
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
Response:
```JavaScript
{
    "requesterID": 460,
    "metadata": {
        "type": "educational",
        "numHours": 25,
        "repToBeGained": 500
    },
    "evaluations": [
        {
            "evaluator": {
                "name": "gu",
                "id": 101,
                "reputationBefore": 300,
                "stake": 45,
                "reputationDuring": 255
            },
            "judgment": false
        }
    ],
    "reputationProduced": -45
}
```




### React by default
The project runs with React by default and hot replacement of changes to the modules. Currently it is on 0.14.3.

### CSS Modules
CSS files loaded into components are locally scoped and you can point to class names with javascript. You can also compose classes together, also from other files. These are also hot loaded. Read more about them [here](http://glenmaddern.com/articles/css-modules).

To turn off CSS Modules remove it from the `webpack.config.js` file.

### Babel and Linting
Both Node server and frontend code runs with Babel. And all of it is linted. With atom you install the `linter` package, then `linter-eslint` and `linter-jscs`. You are covered. Also run `npm run eslint` or `npm run jscs` to verify all files. I would recommend installing `language-babel` package too for syntax highlighting
