const { DataTypes } = require('sequelize');

class BaseModel {
    constructor(sequelize, name, definition, options = {}) {
        this.name = name;
        this.definition = {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },
            version: {
                type: DataTypes.INTEGER,
                defaultValue: 1,
                allowNull: false
            },
            isDeleted: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false
            },
            ...definition
        };
        
        this.options = {
            timestamps: true,
            paranoid: true, // Enables soft deletes
            ...options
        };
        
        this.model = sequelize.define(name, this.definition, this.options);
        
        // Add hooks for versioning and soft deletes
        this.addHooks();
    }
    
    addHooks() {
        // Update version on update
        this.model.beforeUpdate((instance) => {
            instance.version += 1;
            instance.updatedAt = new Date();
        });
        
        // Soft delete hook
        this.model.beforeDestroy((instance) => {
            return instance.update({ isDeleted: true });
        });
        
        // Add scopes
        this.model.addScope('active', {
            where: { isDeleted: false }
        });
        
        this.model.addScope('deleted', {
            where: { isDeleted: true }
        });
    }
    
    // Register with sync manager
    registerWithSync(syncManager) {
        this.syncManager = syncManager;
        this.syncManager.registerModel(this.name, this.model);
        return this;
    }
    
    // Proxy model methods
    static get model() {
        return this.prototype.model;
    }
    
    // Add custom methods here
    static async findActive(id) {
        return this.model.scope('active').findByPk(id);
    }
    
    static async findInactive(id) {
        return this.model.scope('deleted').findByPk(id);
    }
    
    static async restore(id) {
        return this.model.restore({
            where: { id }
        });
    }
}

module.exports = BaseModel;
