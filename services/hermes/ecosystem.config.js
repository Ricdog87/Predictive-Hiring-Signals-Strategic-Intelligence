// PM2 process file for Hermes on Hostinger.
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   # boot persistence
//   pm2 logs rsg-hermes       # tail logs
module.exports = {
  apps: [
    {
      name: 'rsg-hermes',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'production',
      },
      time: true,
      out_file: 'logs/out.log',
      error_file: 'logs/err.log',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
    },
  ],
};
