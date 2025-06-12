const crypto = require('crypto');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { AppError } = require('./error-utils');

const randomBytes = promisify(crypto.randomBytes);
const pbkdf2 = promisify(crypto.pbkdf2);

class CryptoUtils {
  /**
   * Generate a random string of the specified length
   */
  static async randomString(length = 32, charset = 'alphanumeric') {
    const chars = {
      numeric: '0123456789',
      alphabetic: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      alphanumeric: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      hex: '0123456789abcdef',
      base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
      urlsafe: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~',
      binary: '01',
    };
    
    const charSet = typeof charset === 'string' ? (chars[charset] || charset) : charset;
    const charSetLength = charSet.length;
    
    // Generate random bytes
    const bytes = await randomBytes(length);
    let result = '';
    
    // Convert bytes to string using the character set
    for (let i = 0; i < length; i++) {
      result += charSet[bytes[i] % charSetLength];
    }
    
    return result;
  }
  
  /**
   * Generate a secure random token
   */
  static async generateToken(length = 32, encoding = 'hex') {
    const bytes = await randomBytes(Math.ceil(length / 2));
    return bytes.toString(encoding).slice(0, length);
  }
  
  /**
   * Hash a string using the specified algorithm
   */
  static async hash(input, algorithm = 'sha256', encoding = 'hex') {
    if (typeof input !== 'string') {
      input = JSON.stringify(input);
    }
    
    return crypto
      .createHash(algorithm)
      .update(input, 'utf8')
      .digest(encoding);
  }
  
  /**
   * Hash a password with a salt using PBKDF2
   */
  static async hashPassword(password, salt = null, iterations = 10000, keylen = 64, digest = 'sha512') {
    if (!salt) {
      salt = await this.generateToken(16, 'base64');
    }
    
    const derivedKey = await pbkdf2(password, salt, iterations, keylen, digest);
    
    return {
      salt,
      hash: derivedKey.toString('hex'),
      iterations,
      keylen,
      digest,
      // Format: algorithm$iterations$salt$hash
      toString() {
        return `pbkdf2_${digest}$${iterations}$${salt}$${this.hash}`;
      }
    };
  }
  
  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password, hashedPassword) {
    try {
      // Check if hashedPassword is in the encoded format
      if (typeof hashedPassword === 'string' && hashedPassword.includes('$')) {
        const [algorithm, iterations, salt, hash] = hashedPassword.split('$');
        
        if (algorithm.startsWith('pbkdf2_')) {
          const digest = algorithm.split('_')[1];
          const result = await this.hashPassword(password, salt, parseInt(iterations, 10), hash.length / 2, digest);
          return result.hash === hash;
        }
      }
      
      // Fallback to direct comparison (not recommended)
      return password === hashedPassword;
    } catch (error) {
      logger.error('Password verification failed:', error);
      return false;
    }
  }
  
  /**
   * Encrypt data with AES-256-CBC
   */
  static async encrypt(data, key, iv = null) {
    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }
    
    // Generate a random IV if not provided
    if (!iv) {
      iv = crypto.randomBytes(16);
    } else if (typeof iv === 'string') {
      iv = Buffer.from(iv, 'hex');
    }
    
    // Ensure key is the correct length (32 bytes for AES-256)
    const hash = crypto.createHash('sha256').update(key).digest();
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', hash, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return the IV and encrypted data
    return {
      iv: iv.toString('hex'),
      content: encrypted,
      // Format: iv.encrypted
      toString() {
        return `${this.iv}.${this.content}`;
      }
    };
  }
  
  /**
   * Decrypt data with AES-256-CBC
   */
  static async decrypt(encryptedData, key, iv = null) {
    let encrypted, ivBuffer;
    
    // Handle different input formats
    if (typeof encryptedData === 'string') {
      if (encryptedData.includes('.')) {
        // Format: iv.encrypted
        const parts = encryptedData.split('.');
        ivBuffer = Buffer.from(parts[0], 'hex');
        encrypted = parts[1];
      } else if (iv) {
        // Encrypted data and IV provided separately
        ivBuffer = typeof iv === 'string' ? Buffer.from(iv, 'hex') : iv;
        encrypted = encryptedData;
      } else {
        throw new AppError('Invalid encrypted data format', 400, 'INVALID_ENCRYPTED_DATA');
      }
    } else if (encryptedData && encryptedData.iv && encryptedData.content) {
      // Object with iv and content properties
      ivBuffer = typeof encryptedData.iv === 'string' ? 
        Buffer.from(encryptedData.iv, 'hex') : encryptedData.iv;
      encrypted = encryptedData.content;
    } else {
      throw new AppError('Invalid encrypted data format', 400, 'INVALID_ENCRYPTED_DATA');
    }
    
    try {
      // Ensure key is the correct length (32 bytes for AES-256)
      const hash = crypto.createHash('sha256').update(key).digest();
      
      // Create decipher
      const decipher = crypto.createDecipheriv('aes-256-cbc', hash, ivBuffer);
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Try to parse as JSON
      try {
        return JSON.parse(decrypted);
      } catch (e) {
        return decrypted;
      }
    } catch (error) {
      throw new AppError(
        'Failed to decrypt data: ' + error.message,
        400,
        'DECRYPTION_FAILED',
        { originalError: error.message }
      );
    }
  }
  
  /**
   * Generate an RSA key pair
   */
  static async generateKeyPair(modulusLength = 2048, options = {}) {
    const {
      type = 'pkcs1', // 'pkcs1' or 'spki'
      format = 'pem',
      passphrase = null,
      cipher = 'aes-256-cbc',
    } = options;
    
    const keyOptions = {
      modulusLength,
      publicKeyEncoding: {
        type: type === 'pkcs1' ? 'pkcs1' : 'spki',
        format,
      },
      privateKeyEncoding: {
        type: type === 'pkcs1' ? 'pkcs1' : 'pkcs8',
        format,
        ...(passphrase && { cipher, passphrase }),
      },
    };
    
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', keyOptions, (error, publicKey, privateKey) => {
        if (error) {
          reject(error);
        } else {
          resolve({ publicKey, privateKey });
        }
      });
    });
  }
  
  /**
   * Sign data with a private key
   */
  static async sign(data, privateKey, algorithm = 'RSA-SHA256', encoding = 'base64') {
    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }
    
    const sign = crypto.createSign(algorithm);
    sign.update(data, 'utf8');
    
    return sign.sign(privateKey, encoding);
  }
  
  /**
   * Verify a signature with a public key
   */
  static verify(data, publicKey, signature, algorithm = 'RSA-SHA256', encoding = 'base64') {
    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }
    
    const verify = crypto.createVerify(algorithm);
    verify.update(data, 'utf8');
    
    return verify.verify(publicKey, signature, encoding);
  }
  
  /**
   * Generate a certificate signing request (CSR)
   */
  static async generateCSR(options) {
    const {
      key,
      keyPassword,
      commonName,
      organization,
      organizationalUnit,
      locality,
      state,
      country,
      email,
      altNames = [],
    } = options;
    
    const csr = crypto.createCertificateSigningRequest();
    
    const attributes = [
      { name: 'commonName', value: commonName },
      { name: 'organizationName', value: organization },
      { name: 'organizationalUnitName', value: organizationalUnit },
      { name: 'localityName', value: locality },
      { name: 'stateOrProvinceName', value: state },
      { name: 'countryName', value: country },
      { name: 'emailAddress', value: email },
    ].filter(attr => attr.value);
    
    const extensions = [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'subjectAltName', altNames: altNames.map(name => ({
        type: name.startsWith('*.') ? 2 : 2, // DNS type
        value: name.startsWith('*.') ? name.substring(2) : name,
      })) },
    ];
    
    return csr.generate(key, attributes, extensions, keyPassword);
  }
  
  /**
   * Generate a self-signed certificate
   */
  static async generateSelfSignedCertificate(options) {
    const {
      key,
      keyPassword,
      days = 365,
      commonName = 'localhost',
      organization = 'Self-Signed',
      organizationalUnit = 'Development',
      locality = 'Internet',
      state = 'Internet',
      country = 'US',
      email = 'admin@example.com',
      altNames = ['localhost', '127.0.0.1'],
    } = options;
    
    const cert = crypto.createCertificate();
    
    cert.setSubject({
      CN: commonName,
      O: organization,
      OU: organizationalUnit,
      L: locality,
      ST: state,
      C: country,
      emailAddress: email,
    });
    
    cert.setIssuer({
      CN: commonName,
      O: organization,
      OU: organizationalUnit,
      L: locality,
      ST: state,
      C: country,
      emailAddress: email,
    });
    
    cert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
      { name: 'subjectAltName', altNames: altNames.map(name => ({
        type: name.startsWith('*.') ? 2 : 2, // DNS type
        value: name.startsWith('*.') ? name.substring(2) : name,
      })) },
    ]);
    
    cert.setSerialNumber(this._generateSerialNumber());
    cert.setValidity(days + 'd');
    
    cert.sign(key, crypto.createHash('sha256'));
    
    return cert.toPEM();
  }
  
  /**
   * Generate a random serial number for certificates
   */
  static _generateSerialNumber() {
    return '0x' + crypto.randomBytes(16).toString('hex');
  }
  
  /**
   * Generate a secure password with the specified requirements
   */
  static generatePassword(length = 16, options = {}) {
    const {
      numbers = true,
      symbols = true,
      uppercase = true,
      lowercase = true,
      excludeSimilar = true,
      excludeAmbiguous = true,
    } = options;
    
    let charset = '';
    
    if (numbers) charset += '0123456789';
    if (symbols) charset += '!@#$%^&*()_+~`|}{\\[\\]?\\./\\-=';
    if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    
    // Remove similar characters
    if (excludeSimilar) {
      charset = charset.replace(/[ilLI|`oO0]/g, '');
    }
    
    // Remove ambiguous characters
    if (excludeAmbiguous) {
      charset = charset.replace(/[{}[\]()/\\'"`~,;:.<>\s]/g, '');
    }
    
    // Ensure we have at least one character type
    if (!charset) {
      throw new AppError('At least one character type must be enabled', 400, 'INVALID_PASSWORD_CONFIG');
    }
    
    // Generate password
    let password = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += charset[bytes[i] % charset.length];
    }
    
    return password;
  }
  
  /**
   * Check password strength
   */
  static checkPasswordStrength(password) {
    const result = {
      score: 0,
      strength: 'Very Weak',
      suggestions: [],
    };
    
    // Length check
    if (password.length >= 12) result.score += 2;
    else if (password.length >= 8) result.score += 1;
    else result.suggestions.push('Use at least 12 characters for a strong password');
    
    // Character diversity
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    
    const diversity = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    result.score += diversity - 1; // 0-3 points
    
    if (diversity < 3) {
      result.suggestions.push('Use a mix of uppercase, lowercase, numbers, and symbols');
    }
    
    // Common patterns
    const commonPasswords = [
      'password', '123456', 'qwerty', 'letmein', 'admin', 'welcome', 'monkey', 'sunshine',
      'password1', '12345678', '123456789', '1234567', '123123', '111111', 'qwerty123',
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      result.score = 0;
      result.suggestions = ['Avoid common passwords'];
      return result;
    }
    
    // Repeated characters
    if (/(.)\1{2,}/.test(password)) {
      result.score = Math.max(0, result.score - 1);
      result.suggestions.push('Avoid repeated characters');
    }
    
    // Sequential characters
    if (/(?:0123|1234|2345|3456|4567|5678|6789|7890|qwer|wert|erty|rtyu|tyui|yuio|uiop|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm)/i.test(password)) {
      result.score = Math.max(0, result.score - 1);
      result.suggestions.push('Avoid sequential characters');
    }
    
    // Dictionary words (simple check)
    const dictionaryWords = ['password', 'welcome', 'admin', 'letmein', 'monkey', 'sunshine'];
    if (dictionaryWords.some(word => password.toLowerCase().includes(word))) {
      result.score = Math.max(0, result.score - 1);
      result.suggestions.push('Avoid dictionary words');
    }
    
    // Determine strength
    if (result.score >= 4) result.strength = 'Strong';
    else if (result.score >= 2) result.strength = 'Moderate';
    else if (result.score >= 1) result.strength = 'Weak';
    else result.strength = 'Very Weak';
    
    // Remove duplicate suggestions
    result.suggestions = [...new Set(result.suggestions)];
    
    return result;
  }
}

module.exports = CryptoUtils;
