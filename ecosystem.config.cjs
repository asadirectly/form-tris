module.exports = {
  apps: [
    {
      name: "form-tris",
      script: "./server/start.js",
      cwd: __dirname,

      // Explicitly use the Node installation running PM2.
      interpreter: process.execPath,

      // Load environment variables.
      node_args: ["--env-file=.env"],

      env: {
        NODE_ENV: "production"
      },

      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M"
    }
  ]
};
