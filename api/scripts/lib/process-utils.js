const { exec, spawn, execSync, spawnSync } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const readline = require('readline');
const { Writable } = require('stream');
const logger = require('./logger');
const { AppError } = require('./error-utils');

const execAsync = promisify(exec);

class ProcessUtils {
  /**
   * Execute a shell command and return the result
   */
  static async execute(command, options = {}) {
    const {
      cwd = process.cwd(),
      env = process.env,
      timeout = 0,
      maxBuffer = 10 * 1024 * 1024, // 10MB
      shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      input = null,
      silent = false,
      stdio = 'pipe',
      encoding = 'utf8',
      killSignal = 'SIGTERM',
      windowsHide = true,
      windowsVerbatimArguments = false,
    } = options;

    // Log the command if not in silent mode
    if (!silent) {
      logger.debug(`Executing command: ${command}`, { cwd });
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env,
        timeout,
        maxBuffer,
        shell,
        input,
        encoding,
        killSignal,
        windowsHide,
        windowsVerbatimArguments,
      });

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: 0,
        signal: null,
        command,
      };
    } catch (error) {
      if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
        throw new AppError(
          `Command timed out after ${timeout}ms: ${command}`,
          504,
          'COMMAND_TIMEOUT',
          { command, timeout }
        );
      }

      // For exec, the error contains stdout and stderr
      return {
        stdout: error.stdout ? error.stdout.toString().trim() : '',
        stderr: error.stderr ? error.stderr.toString().trim() : error.message,
        code: error.code || 1,
        signal: error.signal || null,
        command,
        error,
      };
    }
  }

  /**
   * Spawn a child process with real-time output
   */
  static spawn(command, args = [], options = {}) {
    const {
      cwd = process.cwd(),
      env = process.env,
      stdio = 'inherit',
      shell = false,
      detached = false,
      windowsVerbatimArguments = false,
      windowsHide = true,
      timeout = 0,
      killSignal = 'SIGTERM',
      uid = null,
      gid = null,
      onStdout = null,
      onStderr = null,
      onError = null,
      onClose = null,
      silent = false,
    } = options;

    return new Promise((resolve, reject) => {
      // Log the command if not in silent mode
      if (!silent) {
        const commandStr = [command, ...args].join(' ');
        logger.debug(`Spawning process: ${commandStr}`, { cwd });
      }

      const child = spawn(command, args, {
        cwd,
        env,
        stdio,
        shell,
        detached,
        windowsVerbatimArguments,
        windowsHide,
        uid,
        gid,
      });

      let stdout = '';
      let stderr = '';
      let timeoutId = null;

      // Set up timeout if specified
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          child.kill(killSignal);
          reject(
            new AppError(
              `Process timed out after ${timeout}ms`,
              504,
              'PROCESS_TIMEOUT',
              { command, args, timeout }
            )
          );
        }, timeout);
      }

      // Handle stdout
      if (child.stdout) {
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (data) => {
          const str = data.toString();
          stdout += str;
          if (onStdout) onStdout(str);
        });
      }

      // Handle stderr
      if (child.stderr) {
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (data) => {
          const str = data.toString();
          stderr += str;
          if (onStderr) onStderr(str);
        });
      }

      // Handle process error
      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (onError) onError(error);
        reject(error);
      });

      // Handle process close
      child.on('close', (code, signal) => {
        if (timeoutId) clearTimeout(timeoutId);
        
        const result = {
          code,
          signal,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          command: [command, ...args].join(' '),
        };
        
        if (onClose) onClose(result);
        
        if (code === 0) {
          resolve(result);
        } else {
          const error = new Error(`Process exited with code ${code}`);
          Object.assign(error, result);
          reject(error);
        }
      });
    });
  }

  /**
   * Execute a command with sudo privileges
   */
  static async sudo(command, options = {}) {
    const {
      password = null,
      prompt = 'sudo',
      spawnOptions = {},
      ...rest
    } = options;

    // On Windows, we need to run the command in an elevated command prompt
    if (process.platform === 'win32') {
      // TODO: Implement Windows elevation
      throw new AppError('sudo is not supported on Windows', 501, 'NOT_IMPLEMENTED');
    }

    // On Unix-like systems, use sudo
    const args = ['-S', '-p', prompt, '--', 'sh', '-c', command];
    
    // If password is provided, pass it to sudo
    if (password) {
      return this.spawn('sudo', args, {
        ...spawnOptions,
        input: `${password}\n`,
        ...rest,
      });
    }
    
    // Otherwise, let sudo prompt for the password
    return this.spawn('sudo', args, { ...spawnOptions, ...rest });
  }

  /**
   * Execute a command and return the output as a string
   */
  static async capture(command, options = {}) {
    const { trim = true, ...rest } = options;
    const result = await this.execute(command, { ...rest, stdio: 'pipe' });
    return trim ? result.stdout.trim() : result.stdout;
  }

  /**
   * Check if a command exists
   */
  static async commandExists(command) {
    try {
      await this.execute(`command -v ${command} >/dev/null 2>&1 || { exit 1; }`, { silent: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the path to a command
   */
  static async which(command) {
    try {
      return await this.capture(`which ${command}`);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the current working directory
   */
  static getCwd() {
    return process.cwd();
  }

  /**
   * Change the current working directory
   */
  static chdir(directory) {
    process.chdir(directory);
    return this.getCwd();
  }

  /**
   * Get environment variables
   */
  static getEnv() {
    return { ...process.env };
  }

  /**
   * Set environment variables
   */
  static setEnv(vars) {
    Object.assign(process.env, vars);
    return this.getEnv();
  }

  /**
   * Get the process ID
   */
  static getPid() {
    return process.pid;
  }

  /**
   * Get the parent process ID
   */
  static getPpid() {
    return process.ppid;
  }

  /**
   * Get the process title
   */
  static getTitle() {
    return process.title;
  }

  /**
   * Set the process title
   */
  static setTitle(title) {
    process.title = title;
    return this.getTitle();
  }

  /**
   * Get the process arguments
   */
  static getArgs() {
    return [...process.argv];
  }

  /**
   * Get the process executable path
   */
  static getExecPath() {
    return process.execPath;
  }

  /**
   * Get the Node.js version
   */
  static getNodeVersion() {
    return process.version;
  }

  /**
   * Get the platform
   */
  static getPlatform() {
    return process.platform;
  }

  /**
   * Get the CPU architecture
   */
  static getArch() {
    return process.arch;
  }

  /**
   * Get the system uptime in seconds
   */
  static getUptime() {
    return process.uptime();
  }

  /**
   * Get the system load average
   */
  static getLoadAvg() {
    return os.loadavg();
  }

  /**
   * Get the total system memory in bytes
   */
  static getTotalMemory() {
    return os.totalmem();
  }

  /**
   * Get the free system memory in bytes
   */
  static getFreeMemory() {
    return os.freemem();
  }

  /**
   * Get the system CPU info
   */
  static getCpuInfo() {
    return os.cpus();
  }

  /**
   * Get the system network interfaces
   */
  static getNetworkInterfaces() {
    return os.networkInterfaces();
  }

  /**
   * Get the system hostname
   */
  static getHostname() {
    return os.hostname();
  }

  /**
   * Get the system temp directory
   */
  static getTempDir() {
    return os.tmpdir();
  }

  /**
   * Get the system home directory
   */
  static getHomeDir() {
    return os.homedir();
  }

  /**
   * Get the system user info
   */
  static getUserInfo() {
    return os.userInfo();
  }

  /**
   * Get the system endianness
   */
  static getEndianness() {
    return os.endianness();
  }

  /**
   * Exit the process with the specified code
   */
  static exit(code = 0) {
    process.exit(code);
  }

  /**
   * Kill a process by PID
   */
  static kill(pid, signal = 'SIGTERM') {
    try {
      process.kill(pid, signal);
      return true;
    } catch (error) {
      if (error.code === 'ESRCH') {
        return false; // No such process
      }
      throw error;
    }
  }


  /**
   * Check if the current process is running in a terminal
   */
  static isTTY() {
    return process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY;
  }

  /**
   * Check if the current process is running with a debugger attached
   */
  static isDebug() {
    return /--(inspect|debug)-/.test(process.execArgv.join(' ')) || 
           /--inspect/.test(process.env.NODE_OPTIONS || '');
  }

  /**
   * Get the current process memory usage
   */
  static getMemoryUsage() {
    return process.memoryUsage();
  }

  /**
   * Get the current process CPU usage
   */
  static getCpuUsage() {
    return process.cpuUsage();
  }

  /**
   * Get the current process resource usage
   */
  static getResourceUsage() {
    if (process.resourceUsage) {
      return process.resourceUsage();
    }
    // Fallback for Node.js < 12.6.0
    return {
      userCpuTime: 0,
      systemCpuTime: 0,
      maxRSS: 0,
      sharedMemorySize: 0,
      unsharedDataSize: 0,
      unsharedStackSize: 0,
      minorPageFault: 0,
      majorPageFault: 0,
      swappedOut: 0,
      fsRead: 0,
      fsWrite: 0,
      ipcSent: 0,
      ipcReceived: 0,
      signalsCount: 0,
      voluntaryContextSwitches: 0,
      involuntaryContextSwitches: 0,
    };
  }

  /**
   * Run garbage collection (only works with --expose-gc)
   */
  static gc() {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Run a function with a timeout
   */
  static withTimeout(fn, timeout, ...args) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new AppError(`Operation timed out after ${timeout}ms`, 504, 'OPERATION_TIMEOUT'));
      }, timeout);

      Promise.resolve(fn(...args))
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Run a function with retries
   */
  static async withRetry(fn, options = {}) {
    const {
      retries = 3,
      delay = 1000,
      backoff = 2,
      maxDelay = 30000,
      timeout = 0,
      shouldRetry = (error) => true,
      onRetry = (error, attempt, delay) => {
        logger.warn(`Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`);
      },
    } = options;

    let lastError;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (timeout > 0) {
          return await this.withTimeout(fn, timeout);
        }
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === retries || !shouldRetry(error)) {
          break;
        }

        if (onRetry) {
          onRetry(error, attempt, currentDelay);
        }

        if (currentDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay = Math.min(currentDelay * backoff, maxDelay);
        }
      }
    }


    throw lastError;
  }

  /**
   * Run a function with a mutex lock
   */
  static withLock(key, fn, options = {}) {
    const { timeout = 0, maxConcurrent = 1 } = options;
    
    if (!this._locks) {
      this._locks = new Map();
    }
    
    if (!this._locks.has(key)) {
      this._locks.set(key, {
        queue: [],
        running: 0,
      });
    }
    
    const lock = this._locks.get(key);
    
    return new Promise((resolve, reject) => {
      const execute = async () => {
        lock.running++;
        
        try {
          const result = await Promise.resolve(fn());
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          lock.running--;
          this._processLockQueue(key);
        }
      };
      
      lock.queue.push({
        execute,
        timeout,
        timer: timeout > 0 ? setTimeout(() => {
          const index = lock.queue.findIndex(item => item.execute === execute);
          if (index >= 0) {
            lock.queue.splice(index, 1);
            reject(new AppError(`Lock timeout after ${timeout}ms`, 504, 'LOCK_TIMEOUT'));
          }
        }, timeout) : null,
      });
      
      this._processLockQueue(key, maxConcurrent);
    });
  }
  
  /**
   * Process the lock queue
   */
  static _processLockQueue(key, maxConcurrent = 1) {
    if (!this._locks || !this._locks.has(key)) {
      return;
    }
    
    const lock = this._locks.get(key);
    
    while (lock.queue.length > 0 && lock.running < maxConcurrent) {
      const next = lock.queue.shift();
      if (next.timer) clearTimeout(next.timer);
      next.execute();
    }
    
    if (lock.queue.length === 0 && lock.running === 0) {
      this._locks.delete(key);
    }
  }
}

module.exports = ProcessUtils;
