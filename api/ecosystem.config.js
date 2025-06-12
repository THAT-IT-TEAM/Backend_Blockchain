module.exports = {
  apps: [
    {
      name: 'blockchain-api',
      script: './blockchain-api.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Advanced features
      max_restarts: 10,           // Maximum number of consecutive unstable restarts (1 by default)
      min_uptime: '5s',           // Minimum uptime of the script to be considered started
      listen_timeout: 5000,        // Time in ms before forcing a reload if app not listening
      kill_timeout: 3000,          // Time in ms before sending SIGKILL
      wait_ready: true,            // Wait for process to send `ready` message before considering it online
      // Graceful start/stop
      shutdown_with_message: false, // Shutdown an application with process.send('shutdown') instead of process.kill(pid, SIGINT)
      // Logging
      log_type: 'json',            // Log format ('json' or 'raw')
      vizion: true,                // Enable/disable versioning metadata
      // Control flow
      force: false,                // Force start even if app already started
      // Watch & Reload
      watch: false,                // Enable file watching
      ignore_watch: [             // Ignore these file changes
        'node_modules',
        'logs',
        '.git',
        '.github',
        'test',
        'tests',
        'coverage',
        'public',
        'tmp',
        'backups'
      ],
      watch_options: {
        followSymlinks: false,
        usePolling: true,
        alwaysStat: true,
        useFsEvents: false
      },
      // Advanced monitoring
      min_uptime: '60s',
      max_restarts: 10,
      restart_delay: 5000,
      // Environment variables
      env: {
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=1024',
        UV_THREADPOOL_SIZE: 16
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NODE_OPTIONS: '--max-old-space-size=2048',
        UV_THREADPOOL_SIZE: 32,
        WATCH: 'false',
        INSTANCE_ID: 'production',
        NODE_APP_INSTANCE: 'production',
        PM2_GRACEFUL_LISTEN_TIMEOUT: 5000,
        PM2_KILL_TIMEOUT: 3000
      },
      // Advanced process management
      node_args: [
        '--max-http-header-size=16384',
        '--trace-warnings',
        '--unhandled-rejections=strict'
      ],
      // Advanced error handling
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      combine_logs: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Process management
      kill_timeout: 3000,
      wait_ready: true,
      listen_timeout: 5000,
      // Advanced features
      interpreter: 'node',
      interpreter_args: '--harmony',
      // PM2 internal settings
      pmx: false,
      automation: true,
      // Advanced process monitoring
      vizion: true,
      // Process title
      update_env: true,
      // Process management
      force: false,
      // Advanced process management
      max_memory_restart: '1G',
      // Advanced process management
      min_uptime: '60s',
      max_restarts: 10,
      restart_delay: 5000,
      // Advanced process management
      exp_backoff_restart_delay: 100,
      // Advanced process management
      max_restarts: 10,
      min_uptime: '60s',
      // Advanced process management
      listen_timeout: 5000,
      kill_timeout: 3000,
      wait_ready: true,
      // Advanced process management
      autorestart: true,
      watch: false,
      // Advanced process management
      instances: 0,
      exec_mode: 'cluster',
      // Advanced process management
      node_args: [],
      // Advanced process management
      args: [],
      // Advanced process management
      script: './blockchain-api.js',
      // Advanced process management
      name: 'blockchain-api',
      // Advanced process management
      cwd: process.cwd(),
      // Advanced process management
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        NODE_OPTIONS: '--max-old-space-size=1024',
        UV_THREADPOOL_SIZE: 16
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NODE_OPTIONS: '--max-old-space-size=2048',
        UV_THREADPOOL_SIZE: 32
      },
      // Advanced process management
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      combine_logs: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Process management
      kill_timeout: 3000,
      wait_ready: true,
      listen_timeout: 5000,
      // Advanced features
      interpreter: 'node',
      interpreter_args: '--harmony',
      // PM2 internal settings
      pmx: false,
      automation: true,
      // Advanced process monitoring
      vizion: true,
      // Process title
      update_env: true,
      // Process management
      force: false
    }
  ],
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-production-server'],
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/blockchain-file-storage-api.git',
      path: '/var/www/blockchain-api',
      'post-deploy': 'npm install && npm run db:migrate && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=2048',
        UV_THREADPOOL_SIZE: 32
      }
    },
    staging: {
      user: 'deploy',
      host: ['your-staging-server'],
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/blockchain-file-storage-api.git',
      path: '/var/www/blockchain-api-staging',
      'post-deploy': 'npm install && npm run db:migrate && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging',
        NODE_OPTIONS: '--max-old-space-size=1024',
        UV_THREADPOOL_SIZE: 16
      }
    }
  }
};
