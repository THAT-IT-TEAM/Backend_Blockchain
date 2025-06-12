// Example of how to use the configuration system
const Config = require('../lib/config');

// Get app configuration
const appConfig = {
  name: Config.get('app.name'),
  port: Config.get('app.port'),
  env: Config.env,
  isProduction: Config.isProduction(),
  isDevelopment: Config.isDevelopment()
};

// Get database configuration
const dbConfig = Config.database('sqlite');

// Get storage configuration
const storageConfig = Config.storage('local');

// Get blockchain configuration
const blockchainConfig = Config.blockchain('ethereum');

// Get API configuration
const apiConfig = Config.api;

console.log('App Config:', appConfig);
console.log('Database Config:', dbConfig);
console.log('Storage Config:', storageConfig);
console.log('Blockchain Config:', blockchainConfig);
console.log('API Config:', {
  version: apiConfig.version,
  docs: apiConfig.docs,
  rateLimit: apiConfig.rateLimit
});

// Example of environment-specific configuration
console.log('Environment:', Config.env);
console.log('Is Production?', Config.isProduction());
console.log('Is Development?', Config.isDevelopment());

// Example of using configuration in a function
function startServer() {
  const port = Config.get('app.port', 3000);
  const host = Config.get('app.host', '0.0.0.0');
  
  console.log(`Starting server on ${host}:${port} in ${Config.env} mode`);
  
  // Start your server here
  // app.listen(port, host, () => {
  //   console.log(`Server is running on http://${host}:${port}`);
  // });
}

// Uncomment to test
// startServer();
