import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getToken, clearToken } from './auth';

// Point to our API server on port 3050
const API_BASE_URL = 'http://localhost:3050';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Ensure cookies are sent with requests
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('Adding auth token to request:', token.substring(0, 10) + '...');
        } else {
          console.warn('No auth token found for request to:', config.url);
        }
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle 401 errors
    this.client.interceptors.response.use(
      (response) => {
        console.log('API Response:', response.config.url, response.status);
        return response;
      },
      (error) => {
        console.error('API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });
        
        if (error.response?.status === 401) {
          console.warn('Authentication required, redirecting to login');
          // Clear token and redirect to login on 401
          clearToken();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async register(userData: { email: string; password: string; role: string }) {
    const response = await this.client.post('/auth/register', userData);
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Users endpoints
  async getUsers() {
    const response = await this.client.get('/api/users');
    return response.data.users;
  }

  async getUserById(id: string) {
    const response = await this.client.get(`/api/users/${id}`);
    return response.data;
  }

  async createUser(userData: any) {
    const response = await this.client.post('/api/users', userData);
    return response.data;
  }

  // Expenses endpoints
  async getExpenses() {
    const response = await this.client.get('/api/expenses');
    return response.data.expenses;
  }

  async createExpense(expenseData: any) {
    const response = await this.client.post('/api/expenses', expenseData);
    return response.data;
  }

  async updateExpense(id: string, expenseData: any) {
    const response = await this.client.put(`/api/expenses/${id}`, expenseData);
    return response.data;
  }

  // Vendors endpoints
  async getVendors() {
    const response = await this.client.get('/api/vendors');
    return response.data.profiles;
  }

  async createVendor(vendorData: any) {
    const response = await this.client.post('/api/vendors', vendorData);
    return response.data;
  }

  // Blockchain endpoints
  async getBlockchainInfo() {
    const response = await this.client.get('/api/blockchain/info');
    return response.data;
  }

  // File upload
  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await this.client.post('/api/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }

  // File endpoints
  async getFiles() {
    const response = await this.client.get('/api/files');
    return response.data.files;
  }

  async getFilesByBucket(bucketName: string) {
    const response = await this.client.get(`/api/files?bucket=${bucketName}`);
    return response.data.files;
  }

  async getBuckets() {
    const response = await this.client.get('/api/files/buckets');
    return response.data.buckets;
  }

  async deleteFile(id: string) {
    const response = await this.client.delete(`/api/files/${id}`);
    return response.data;
  }

  // DB inspection endpoints
  async getTables() {
    const response = await this.client.get('/api/db/tables');
    return response.data.tables;
  }

  async getTableData(tableName: string) {
    const response = await this.client.get(`/api/db/${tableName}`);
    return response.data.data;
  }

  async getTableSchema(tableName: string) {
    const response = await this.client.get(`/api/db/${tableName}/schema`);
    return response.data.schema;
  }

  async getDatabaseRelationships() {
    const response = await this.client.get('/api/db/relationships');
    return response.data.relationships;
  }

  // Generic CRUD operations
  async createRecord(table: string, data: any) {
    const response = await this.client.post(`/api/${table}`, data);
    return response.data;
  }

  async updateRecord(table: string, id: string, data: any) {
    const response = await this.client.put(`/api/${table}/${id}`, data);
    return response.data;
  }

  async deleteRecord(table: string, id: string) {
    const response = await this.client.delete(`/api/${table}/${id}`);
    return response.data;
  }

  async createFiles(fileData: any) {
    const response = await this.client.post('/api/files', fileData);
    return response.data;
  }

  // Add this method for deleting a bucket
  async deleteBucket(bucketName: string) {
    const response = await this.client.delete(`/api/files/bucket/${encodeURIComponent(bucketName)}`);
    return response.data;
  }

  // Add this method for uploading a file to a specific bucket
  async uploadFileToBucket(file: File, bucketName: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucketName);
    const response = await this.client.post(`/api/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Add this method for creating a bucket
  async createBucket(bucketName: string) {
    const response = await this.client.post('/api/files/bucket', { name: bucketName });
    return response.data;
  }
}

export const api = new ApiService();
