module.exports = {
  apps: [{
    name: 'zlto_node',
    script: './server.js'
  }],
  deploy: {
    production: {
      user: 'ec2-user',
      host: 'ec2-54-229-185-150.eu-west-1.compute.amazonaws.com',
      key: '~/.ssh/node_eval_p2p.pem',
      ref: 'origin/master',
      repo: 'git@github.com:michaelgu95/p2pEvalNode.git',
      path: '/home/ec2-user/zlto_node',
      'post-deploy': 'npm install'
    }
  }
}
