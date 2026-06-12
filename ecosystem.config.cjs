module.exports = {
  apps: [
    {
      name: "next-app",
      script: ".next/standalone/server.js",
      exec_mode: "cluster",
      instances: "max",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
