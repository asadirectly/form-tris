export default {
  apps: [
    {
      name: "form-tris",
      script: "node",
      args: "--env-file=.env server/start.js",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
