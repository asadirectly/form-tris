module.exports = {
  apps: [
    {
      name: "form-tris",
      script: "./server/start.js",
      env_file: ".env", 
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
