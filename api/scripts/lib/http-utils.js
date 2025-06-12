const https = require('https');
const http = require('http');
const { URL } = require('url');
const { promisify } = require('util');
const zlib = require('zlib');
const logger = require('./logger');
const { AppError } = require('./error-utils');

const gunzip = promisify(zlib.gunzip);
const brotliDecompress = promisify(zlib.brotliDecompress);

class HttpUtils {
  /**
   * Make an HTTP/HTTPS request
   */
  static async request(url, options = {}) {
    const startTime = Date.now();
    
    try {
      // Parse URL
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      
      // Default options
      const defaultOptions = {
        method: 'GET',
        headers: {
          'User-Agent': 'Blockchain-API/1.0',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: 30000, // 30 seconds
        maxRedirects: 5,
        followRedirect: true,
        decompress: true,
        responseType: 'json', // 'json', 'text', 'buffer', or 'stream'
      };
      
      // Merge options
      const requestOptions = {
        ...defaultOptions,
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options.headers,
        },
      };
      
      // Log request
      logger.debug(`HTTP ${requestOptions.method} ${url}`, {
        headers: requestOptions.headers,
        body: requestOptions.body ? '[body]' : undefined,
      });
      
      // Make the request
      const response = await this._makeRequest(parsedUrl, requestOptions, isHttps);
      
      // Handle redirects
      if (requestOptions.followRedirect && [301, 302, 303, 307, 308].includes(response.statusCode)) {
        if (requestOptions.maxRedirects <= 0) {
          throw new AppError('Maximum redirects exceeded', 500, 'TOO_MANY_REDIRECTS');
        }
        
        const location = response.headers.location;
        if (!location) {
          throw new AppError('Received redirect status code but no Location header', 500, 'INVALID_REDIRECT');
        }
        
        // Resolve relative URLs
        const redirectUrl = new URL(location, url);
        
        logger.debug(`Redirecting to: ${redirectUrl.toString()}`);
        
        // For 303, always use GET regardless of original method
        const method = response.statusCode === 303 ? 'GET' : requestOptions.method;
        
        // Remove body for GET/HEAD requests
        const body = ['GET', 'HEAD'].includes(method) ? undefined : requestOptions.body;
        
        // Make the redirect request
        return this.request(redirectUrl.toString(), {
          ...requestOptions,
          method,
          body,
          maxRedirects: requestOptions.maxRedirects - 1,
        });
      }
      
      // Handle response
      const responseTime = Date.now() - startTime;
      const contentType = response.headers['content-type'] || '';
      
      // Log response
      logger.debug(`HTTP ${response.statusCode} ${url} (${responseTime}ms)`, {
        statusCode: response.statusCode,
        headers: response.headers,
        body: '[body]',
      });
      
      // Handle error status codes
      if (response.statusCode >= 400) {
        let errorMessage = `Request failed with status code ${response.statusCode}`;
        let errorBody;
        
        try {
          errorBody = await this._getResponseBody(response, requestOptions);
          if (typeof errorBody === 'object' && errorBody.message) {
            errorMessage = errorBody.message;
          } else if (typeof errorBody === 'string') {
            errorMessage = errorBody;
          }
        } catch (e) {
          // Ignore body parsing errors
        }
        
        const error = new AppError(
          errorMessage,
          response.statusCode,
          `HTTP_${response.statusCode}`,
          errorBody
        );
        
        error.response = {
          status: response.statusCode,
          headers: response.headers,
          data: errorBody,
        };
        
        throw error;
      }
      
      // Process response body
      const data = await this._getResponseBody(response, requestOptions);
      
      return {
        status: response.statusCode,
        statusText: response.statusMessage,
        headers: response.headers,
        data,
        responseTime,
        request: {
          url,
          method: requestOptions.method,
          headers: requestOptions.headers,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      const errorMessage = error.message || 'Request failed';
      const errorCode = error.code || 'REQUEST_FAILED';
      
      throw new AppError(
        errorMessage,
        error.statusCode || 500,
        errorCode,
        error.details
      );
    }
  }
  
  /**
   * Make the actual HTTP/HTTPS request
   */
  static _makeRequest(url, options, isHttps) {
    return new Promise((resolve, reject) => {
      const protocol = isHttps ? https : http;
      const req = protocol.request(url, options, (res) => {
        resolve(res);
      });
      
      // Handle errors
      req.on('error', (error) => {
        reject(error);
      });
      
      // Handle timeout
      if (options.timeout) {
        req.setTimeout(options.timeout, () => {
          req.destroy(new AppError(`Request timed out after ${options.timeout}ms`, 504, 'REQUEST_TIMEOUT'));
        });
      }
      
      // Send request body if provided
      if (options.body) {
        if (typeof options.body === 'object' && !Buffer.isBuffer(options.body)) {
          req.setHeader('Content-Type', 'application/json');
          req.write(JSON.stringify(options.body));
        } else {
          req.write(options.body);
        }
      }
      
      req.end();
    });
  }
  
  /**
   * Get the response body with proper decompression
   */
  static async _getResponseBody(response, options) {
    // Handle streaming responses
    if (options.responseType === 'stream') {
      return response;
    }
    
    // Collect response chunks
    const chunks = [];
    
    for await (const chunk of response) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    
    // Handle empty response
    if (buffer.length === 0) {
      return null;
    }
    
    // Decompress if needed
    const contentEncoding = (response.headers['content-encoding'] || '').toLowerCase();
    let decompressedBuffer = buffer;
    
    if (options.decompress) {
      try {
        if (contentEncoding.includes('gzip')) {
          decompressedBuffer = await gunzip(buffer);
        } else if (contentEncoding.includes('deflate')) {
          decompressedBuffer = await new Promise((resolve, reject) => {
            zlib.inflate(buffer, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        } else if (contentEncoding.includes('br')) {
          decompressedBuffer = await brotliDecompress(buffer);
        }
      } catch (error) {
        logger.warn('Failed to decompress response:', error);
        // Use original buffer if decompression fails
      }
    }
    
    // Convert to the requested type
    const contentType = response.headers['content-type'] || '';
    
    if (options.responseType === 'buffer') {
      return decompressedBuffer;
    }
    
    const text = decompressedBuffer.toString('utf8');
    
    if (options.responseType === 'text' || !contentType.includes('application/json')) {
      return text;
    }
    
    try {
      return JSON.parse(text);
    } catch (error) {
      logger.warn('Failed to parse JSON response:', error);
      return text;
    }
  }
  
  /**
   * Make a GET request
   */
  static get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }
  
  /**
   * Make a POST request
   */
  static post(url, data, options = {}) {
    return this.request(url, { ...options, method: 'POST', body: data });
  }
  
  /**
   * Make a PUT request
   */
  static put(url, data, options = {}) {
    return this.request(url, { ...options, method: 'PUT', body: data });
  }
  
  /**
   * Make a PATCH request
   */
  static patch(url, data, options = {}) {
    return this.request(url, { ...options, method: 'PATCH', body: data });
  }
  
  /**
   * Make a DELETE request
   */
  static delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }
  
  /**
   * Make a HEAD request
   */
  static head(url, options = {}) {
    return this.request(url, { ...options, method: 'HEAD' });
  }
  
  /**
   * Make multiple requests in parallel
   */
  static all(requests) {
    return Promise.all(requests);
  }
  
  /**
   * Make multiple requests in parallel with concurrency control
   */
  static async batch(requests, concurrency = 5) {
    const results = [];
    const executing = [];
    
    for (const [index, request] of requests.entries()) {
      const p = Promise.resolve().then(() => request.then(
        result => ({ status: 'fulfilled', value: result }),
        error => ({ status: 'rejected', reason: error })
      ));
      
      results.push(p);
      
      if (concurrency <= requests.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        
        if (executing.length >= concurrency) {
          await Promise.race(executing);
        }
      }
    }
    
    return Promise.all(results);
  }
}

module.exports = HttpUtils;
