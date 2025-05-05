const sql = require('mssql');
const bcrypt = require('bcryptjs');

const userModel = {

    getProfileData: async (user_id, callback) => {
        try {
            const request = new sql.Request();
            request.input('user_id', sql.Int, user_id);
            const result = await request.query('SELECT * FROM users WHERE id = @user_id');
            console.log(result);
            callback(null, result.recordset);
        } catch (err) {
            callback(err, null);
        }
    },

    checkDuplicateFields: async (user_id, fieldsToCheck, callback) => {
        const conditions = [];
        const values = {};

        for (const key of ['email', 'username', 'phone_number']) {
            if (fieldsToCheck[key]) {
                conditions.push(`${key} = @${key}`);
                values[key] = fieldsToCheck[key];
            }
        }

        if (conditions.length === 0) return callback(null, []);

        const query = `SELECT * FROM users WHERE (${conditions.join(' OR ')}) AND id != @user_id`;

        try {
            const request = new sql.Request();
            for (const key in values) {
                request.input(key, sql.NVarChar, values[key]);
            }
            request.input('user_id', sql.Int, user_id);
            const result = await request.query(query);
            callback(null, result.recordset);
        } catch (err) {
            callback(err, null);
        }
    },

    updateProfile: async (user_id, fieldsToUpdate, callback) => {
        const updates = [];
        const values = {};

        for (const key in fieldsToUpdate) {
            if (fieldsToUpdate[key] !== undefined) {
                updates.push(`${key} = @${key}`);
                values[key] = fieldsToUpdate[key];
            }
        }

        if (updates.length === 0) {
            return callback(null, { message: 'No fields to update' });
        }

        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = @user_id`;

        try {
            const request = new sql.Request();
            for (const key in values) {
                request.input(key, sql.NVarChar, values[key]);
            }
            request.input('user_id', sql.Int, user_id);
            const result = await request.query(query);
            callback(null, result.rowsAffected);
        } catch (err) {
            callback(err, null);
        }
    },

    updateToken: async (user_id, token, callback) => {
        try {
            const request = new sql.Request();
            request.input('user_id', sql.Int, user_id);
            request.input('token', sql.NVarChar, token);

            // Use MERGE for UPSERT in MSSQL
            const query = `
                MERGE tokens AS target
                USING (SELECT @user_id AS user_id, @token AS token) AS source
                ON target.user_id = source.user_id
                WHEN MATCHED THEN
                    UPDATE SET token = source.token
                WHEN NOT MATCHED THEN
                    INSERT (user_id, token) VALUES (source.user_id, source.token);
            `;

            const result = await request.query(query);
            callback(null, result.rowsAffected);
        } catch (err) {
            callback(err, null);
        }
    },

    checkUserExists: async (username, callback) => {
        try {
            const request = new sql.Request();
            request.input('username', sql.NVarChar, username);
            const result = await request.query('SELECT * FROM users WHERE username = @username');
            callback(null, result.recordset);
        } catch (err) {
            callback(err, null);
        }
    },

    register: async (fieldsToInsert, callback) => {
        const keys = [];
        const placeholders = [];
        const values = {};

        for (const key in fieldsToInsert) {
            if (fieldsToInsert[key] !== undefined) {
                keys.push(key);
                placeholders.push(`@${key}`);
                values[key] = fieldsToInsert[key];
            }
        }

        if (keys.length === 0) {
            throw new Error('No fields to insert');
        }

        const query = `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;

        try {
            const request = new sql.Request();
            for (const key in values) {
                request.input(key, sql.NVarChar, values[key]);
            }
            const result = await request.query(query);
            callback(null, result.rowsAffected);
        } catch (err) {
            callback(err, null);
        }
    }
};

module.exports = userModel;
