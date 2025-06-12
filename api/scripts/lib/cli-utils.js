const readline = require('readline');
const chalk = require('chalk');
const { Writable } = require('stream');
const logger = require('./logger');

// Create a writable stream that doesn't output anything
class NullStream extends Writable {
  _write(chunk, encoding, callback) {
    setImmediate(callback);
  }
}

class CLIUtils {
  /**
   * Parse command line arguments into an object
   */
  static parseArgs(args = process.argv.slice(2)) {
    const result = {
      _: [], // Positional arguments
      '--': [], // Arguments after --
    };
    
    let currentKey = null;
    
    for (const arg of args) {
      if (arg === '--') {
        // All remaining arguments are treated as positional
        result['--'] = args.slice(args.indexOf('--') + 1);
        break;
      } else if (arg.startsWith('--')) {
        // Long option (--key=value or --key value)
        const eqIndex = arg.indexOf('=');
        if (eqIndex > 0) {
          // --key=value format
          const key = arg.substring(2, eqIndex);
          const value = arg.substring(eqIndex + 1);
          result[key] = this.parseValue(value);
          currentKey = null;
        } else {
          // --key [value] format
          const key = arg.substring(2);
          result[key] = true; // Default to true for flags
          currentKey = key;
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        // Short option (-k=value or -k value or -abc)
        const key = arg.substring(1);
        if (key.includes('=')) {
          // -k=value format
          const [k, v] = key.split('=', 2);
          result[k] = this.parseValue(v);
          currentKey = null;
        } else if (key.length > 1) {
          // -abc format (multiple flags)
          for (const char of key) {
            result[char] = true;
          }
          currentKey = null;
        } else {
          // -k [value] format
          result[key] = true;
          currentKey = key;
        }
      } else if (currentKey) {
        // Value for the previous key
        result[currentKey] = this.parseValue(arg);
        currentKey = null;
      } else {
        // Positional argument
        result._.push(arg);
      }
    }
    
    return result;
  }
  
  /**
   * Parse a string value into the appropriate type
   */
  static parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    
    // Check if it's a number
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d*\.\d+$/.test(value)) return parseFloat(value);
    
    // Check if it's a JSON object or array
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        // Not valid JSON, return as string
      }
    }
    
    return value;
  }
  
  /**
   * Prompt the user for input
   */
  static async prompt(question, options = {}) {
    const {
      default: defaultValue = '',
      type = 'input',
      choices = [],
      validate = () => true,
      silent = false,
      mask = null,
    } = options;
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: silent ? new NullStream() : process.stdout,
    });
    
    try {
      while (true) {
        // Build the prompt string
        let promptStr = question;
        
        if (defaultValue !== undefined && defaultValue !== '') {
          if (type === 'password' || silent) {
            promptStr += ` [${'*'.repeat(String(defaultValue).length)}]`;
          } else {
            promptStr += ` [${defaultValue}]`;
          }
        }
        
        if (choices.length > 0) {
          promptStr += `\n${choices.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}\n`;
          promptStr += `Enter a number (1-${choices.length}) or value: `;
        } else {
          promptStr += ': ';
        }
        
        // Get user input
        const answer = await new Promise((resolve) => {
          rl.question(promptStr, resolve);
        });
        
        // Handle empty input (use default if available)
        let result = answer.trim() || (answer === '' && defaultValue !== undefined ? defaultValue : answer);
        
        // If choices are provided, validate the selection
        if (choices.length > 0 && result) {
          // Check if input is a number (index)
          const choiceIndex = parseInt(result, 10) - 1;
          if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < choices.length) {
            result = choices[choiceIndex];
          } else if (!choices.includes(result)) {
            console.log(chalk.red(`\nInvalid choice. Please enter a number between 1 and ${choices.length} or one of the values.`));
            continue;
          }
        }
        
        // Validate the input
        try {
          const isValid = await validate(result);
          if (isValid === true) {
            return type === 'number' ? parseFloat(result) : result;
          } else if (typeof isValid === 'string') {
            console.log(chalk.yellow(`\n${isValid}`));
          } else {
            console.log(chalk.yellow('\nInvalid input. Please try again.'));
          }
        } catch (error) {
          console.log(chalk.red(`\nError: ${error.message}`));
        }
      }
    } finally {
      rl.close();
    }
  }
  
  /**
   * Prompt for confirmation (yes/no)
   */
  static async confirm(question, options = {}) {
    const {
      default: defaultValue = false,
    } = options;
    
    const answer = await this.prompt(`${question} (y/N)`, {
      ...options,
      default: defaultValue ? 'y' : 'n',
      validate: (input) => {
        const normalized = input.toLowerCase().trim();
        if (['y', 'yes', 'n', 'no', ''].includes(normalized)) {
          return true;
        }
        return 'Please answer with "yes" or "no"';
      },
    });
    
    const normalized = answer.toLowerCase().trim();
    return normalized === 'y' || normalized === 'yes';
  }
  
  /**
   * Prompt for a password (hidden input)
   */
  static async password(question, options = {}) {
    return this.prompt(question, {
      ...options,
      type: 'password',
      silent: true,
    });
  }
  
  /**
   * Show a spinner while running an async task
   */
  static async withSpinner(promise, options = {}) {
    const {
      text = 'Processing...',
      successText = 'Done',
      failText = 'Failed',
      spinner = 'dots',
    } = options;
    
    const spinners = {
      dots: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] },
      line: { interval: 130, frames: ['-', '\\', '|', '/'] },
      star: { interval: 70, frames: ['✶', '✸', '✹', '✺', '✹', '✷'] },
      square: { interval: 180, frames: ['◰', '◳', '◲', '◱'] },
    };
    
    const selectedSpinner = typeof spinner === 'string' ? spinners[spinner] || spinners.dots : spinner;
    
    let frameIndex = 0;
    let spinnerInterval;
    
    // Start the spinner
    const startSpinner = () => {
      process.stdout.write('\x1B[?25l'); // Hide cursor
      
      const render = () => {
        const frame = selectedSpinner.frames[frameIndex++ % selectedSpinner.frames.length];
        process.stdout.write(`\r${chalk.blue(frame)} ${text} `);
      };
      
      render();
      spinnerInterval = setInterval(render, selectedSpinner.interval);
    };
    
    // Stop the spinner
    const stopSpinner = (success = true, message = '') => {
      clearInterval(spinnerInterval);
      
      // Clear the line
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      
      // Show the result
      const status = success ? chalk.green('✓') : chalk.red('✗');
      const resultText = success ? (message || successText) : (message || failText);
      
      if (resultText) {
        console.log(`${status} ${resultText}`);
      }
      
      process.stdout.write('\x1B[?25h'); // Show cursor
    };
    
    try {
      startSpinner();
      const result = await Promise.resolve(promise);
      stopSpinner(true, successText);
      return result;
    } catch (error) {
      stopSpinner(false, error.message || failText);
      throw error;
    }
  }
  
  /**
   * Create a progress bar
   */
  static createProgressBar(total, options = {}) {
    const {
      width = 40,
      complete = '=',
      incomplete = '-',
      head = '>',
      clear = false,
      renderThrottle = 16,
    } = options;
    
    let current = 0;
    let lastRender = 0;
    let timer = null;
    
    const render = (force = false) => {
      const now = Date.now();
      if (!force && now - lastRender < renderThrottle) return;
      lastRender = now;
      
      const ratio = Math.min(Math.max(current / total, 0), 1);
      const percent = Math.floor(ratio * 100);
      const completeLength = Math.floor(width * ratio);
      const incompleteLength = width - completeLength;
      
      let bar = '';
      
      if (completeLength > 0) {
        bar += complete.repeat(completeLength - 1);
        bar += head;
      }
      
      if (incompleteLength > 0) {
        bar += incomplete.repeat(incompleteLength);
      }
      
      process.stdout.write(`\r${bar} ${percent}%`);
      
      if (current >= total) {
        process.stdout.write('\n');
      }
    };
    
    const tick = (increment = 1) => {
      current += increment;
      render();
    };
    
    const update = (value) => {
      current = value;
      render();
    };
    
    const start = () => {
      timer = setInterval(render, 100);
      return () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    };
    
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      render(true);
    };
    
    return {
      tick,
      update,
      start,
      stop,
      render,
    };
  }
}

module.exports = CLIUtils;
