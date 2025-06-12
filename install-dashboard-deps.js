const { execSync } = require('child_process');
const path = require('path');

const DASHBOARD_DIR = path.join(__dirname, 'node-dashboard');

console.log('Installing dashboard dependencies...');
try {
    // Install lucide-react and other required dependencies
    execSync('npm install lucide-react', { 
        cwd: DASHBOARD_DIR, 
        stdio: 'inherit' 
    });
    console.log('Successfully installed dashboard dependencies');
} catch (error) {
    console.error('Failed to install dashboard dependencies:', error);
    process.exit(1);
}
