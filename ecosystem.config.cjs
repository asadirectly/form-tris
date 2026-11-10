module.exports = {
  apps: [
    {
      name: "form-tris",
      script: "./server/start.js",
      cwd: __dirname,
      node_args: "--env-file=.env",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
