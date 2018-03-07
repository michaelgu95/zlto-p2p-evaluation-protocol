# p2pEvalNode
A node server for p2p evaluation of work. Primarily for performance comparisons against decentralized smart contract.

**NOTE!** Use the latest version of Node, 9.x.x.

## Install and Running
`git clone https://github.com/christianalfoni/webpack-express-boilerplate.git`

1. npm install
2. npm start
3. navigate to http://localhost:3000 in your browser of choice.


## Overview

### React by default
The project runs with React by default and hot replacement of changes to the modules. Currently it is on 0.14.3.

### CSS Modules
CSS files loaded into components are locally scoped and you can point to class names with javascript. You can also compose classes together, also from other files. These are also hot loaded. Read more about them [here](http://glenmaddern.com/articles/css-modules).

To turn off CSS Modules remove it from the `webpack.config.js` file.

### Babel and Linting
Both Node server and frontend code runs with Babel. And all of it is linted. With atom you install the `linter` package, then `linter-eslint` and `linter-jscs`. You are covered. Also run `npm run eslint` or `npm run jscs` to verify all files. I would recommend installing `language-babel` package too for syntax highlighting
