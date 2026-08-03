module.exports = {
  apps: [
    {
      name: "rtig-adapter",
      cwd: "C:/Users/Administrator/my-next-app",
      script: "./node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      interpreter: "C:/Program Files/nodejs/node.exe",

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      restart_delay: 3000,
      max_memory_restart: "512M",
      kill_timeout: 10000,

      env: {
        NODE_ENV: "production"
      },

      output: "C:/UTCAdapter/logs/pm2-output.log",
      error: "C:/UTCAdapter/logs/pm2-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};