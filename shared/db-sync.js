const EventEmitter = require('events');
const { Sequelize, DataTypes, Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');

class DBSync extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            syncInterval: 30000, // 30 seconds
            conflictStrategy: 'last-write-wins', // or 'merge', 'reject'
            ...config
        };
        
        this.sequelize = null;
        this.models = {};
        this.lastSync = new Date(0);
        this.nodeId = process.env.NODE_ID || crypto.randomUUID();
        this.isSyncing = false;
        this.pendingChanges = [];
        
        // Initialize database connection
        this.initDB();
    }
    
    async initDB() {
        try {
            this.sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: this.config.storage || './database.sqlite',
                logging: false
            });
            
            // Define the sync log model
            this.models.SyncLog = this.sequelize.define('sync_log', {
                id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
                table: DataTypes.STRING,
                recordId: DataTypes.STRING,
                operation: DataTypes.ENUM('create', 'update', 'delete'),
                data: DataTypes.TEXT,
                nodeId: DataTypes.STRING,
                timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
                version: { type: DataTypes.INTEGER, defaultValue: 1 },
                isSynced: { type: DataTypes.BOOLEAN, defaultValue: false }
            });
            
            // Create tables if they don't exist
            await this.sequelize.sync({ alter: true });
            
            // Start the sync loop
            this.startSyncLoop();
            
            console.log('Database sync initialized');
        } catch (error) {
            console.error('Failed to initialize database sync:', error);
            process.exit(1);
        }
    }
    
    // Register a model for synchronization
    registerModel(name, model) {
        this.models[name] = model;
        
        // Add hooks to track changes
        this.addModelHooks(name, model);
    }
    
    // Add hooks to track model changes
    addModelHooks(name, model) {
        model.addHook('afterCreate', async (instance, options) => {
            await this.logChange(name, 'create', instance);
        });
        
        model.addHook('afterUpdate', async (instance, options) => {
            await this.logChange(name, 'update', instance);
        });
        
        model.addHook('afterDestroy', async (instance, options) => {
            await this.logChange(name, 'delete', instance);
        });
    }
    
    // Log a change to the sync log
    async logChange(table, operation, instance) {
        try {
            await this.models.SyncLog.create({
                table,
                recordId: instance.id,
                operation,
                data: JSON.stringify(instance.toJSON()),
                nodeId: this.nodeId,
                timestamp: new Date(),
                isSynced: false
            });
            
            // Trigger sync if not already in progress
            if (!this.isSyncing) {
                this.syncChanges();
            }
        } catch (error) {
            console.error('Failed to log change:', error);
        }
    }
    
    // Start the sync loop
    startSyncLoop() {
        setInterval(() => this.syncChanges(), this.config.syncInterval);
    }
    
    // Sync changes with other nodes
    async syncChanges() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        
        try {
            // Get unsynced changes
            const changes = await this.models.SyncLog.findAll({
                where: { isSynced: false },
                order: [['timestamp', 'ASC']],
                limit: 100 // Batch size
            });
            
            if (changes.length === 0) {
                this.isSyncing = false;
                return;
            }
            
            console.log(`Syncing ${changes.length} changes...`);
            
            // Get list of other nodes from the handler
            const handlerUrl = process.env.HANDLER_URL;
            const response = await axios.get(`${handlerUrl}/services`);
            const nodes = response.data.filter(node => node.id !== this.nodeId);
            
            // Apply changes to other nodes
            for (const node of nodes) {
                try {
                    await axios.post(`${node.url}/api/sync/apply`, {
                        changes: changes.map(change => ({
                            table: change.table,
                            operation: change.operation,
                            data: JSON.parse(change.data),
                            nodeId: this.nodeId,
                            timestamp: change.timestamp,
                            version: change.version
                        }))
                    });
                } catch (error) {
                    console.error(`Failed to sync with node ${node.id}:`, error.message);
                }
            }
            
            // Mark changes as synced
            await this.models.SyncLog.update(
                { isSynced: true },
                { where: { id: { [Op.in]: changes.map(c => c.id) } } }
            );
            
            this.lastSync = new Date();
            this.emit('synced', { count: changes.length });
            
        } catch (error) {
            console.error('Sync failed:', error);
            this.emit('error', error);
        } finally {
            this.isSyncing = false;
        }
    }
    
    // Apply changes from another node
    async applyChanges(changes) {
        const transaction = await this.sequelize.transaction();
        
        try {
            for (const change of changes) {
                const { table, operation, data, nodeId, timestamp, version } = change;
                
                // Skip our own changes
                if (nodeId === this.nodeId) continue;
                
                const model = this.models[table];
                if (!model) continue;
                
                // Apply the change
                switch (operation) {
                    case 'create':
                    case 'update':
                        await model.upsert(data, { transaction });
                        break;
                    case 'delete':
                        await model.destroy({
                            where: { id: data.id },
                            transaction
                        });
                        break;
                }
                
                // Log the applied change (without triggering sync)
                await this.models.SyncLog.create({
                    table,
                    recordId: data.id,
                    operation,
                    data: JSON.stringify(data),
                    nodeId,
                    timestamp,
                    version,
                    isSynced: true
                }, { transaction });
            }
            
            await transaction.commit();
            this.emit('changesApplied', { count: changes.length });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Failed to apply changes:', error);
            throw error;
        }
    }
}

module.exports = DBSync;
