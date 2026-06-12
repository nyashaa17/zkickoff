module.exports = {
  apps: [{
    name: 'next-app',
    script: '.next/standalone/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      PORT: 3000,
      HOSTNAME: '0.0.0.0',  // 👈 must not be removed
      NODE_ENV: 'production'
    }
  }]
}
