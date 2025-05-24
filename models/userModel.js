const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = require('../db.js');

const userModel = {
    getProfileData: async (user_id, callback) => {
        try {
            const result = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
            console.log(result);
            callback(null, result.rows);
        } catch (err) {
            callback(err, null);
        }
    },

    checkDuplicateFields: async (user_id, fieldsToCheck, callback) => {
        const conditions = [];
        const values = [];
        let paramCount = 1;

        for (const key of ['email', 'username', 'phone_number']) {
            if (fieldsToCheck[key]) {
                conditions.push(`${key} = $${paramCount}`);
                values.push(fieldsToCheck[key]);
                paramCount++;
            }
        }

        if (conditions.length === 0) return callback(null, []);

        values.push(user_id);
        const query = `SELECT * FROM users WHERE (${conditions.join(' OR ')}) AND id != $${paramCount}`;

        try {
            const result = await pool.query(query, values);
            callback(null, result.rows);
        } catch (err) {
            callback(err, null);
        }
    },

    updateProfile: async (user_id, fieldsToUpdate, callback) => {
        const updates = [];
        const values = [];
        let paramCount = 1;

        for (const key in fieldsToUpdate) {
            if (fieldsToUpdate[key] !== undefined) {
                updates.push(`${key} = $${paramCount}`);
                values.push(fieldsToUpdate[key]);
                paramCount++;
            }
        }

        if (updates.length === 0) {
            return callback(null, { message: 'No fields to update' });
        }

        values.push(user_id);
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`;

        try {
            const result = await pool.query(query, values);
            callback(null, result.rowCount);
        } catch (err) {
            callback(err, null);
        }
    },

    updateToken: async (user_id, token, callback) => {
        try {
            const query = `
                INSERT INTO tokens (user_id, token)
                VALUES ($1, $2)
                ON CONFLICT (user_id)
                DO UPDATE SET token = EXCLUDED.token
            `;
            const result = await pool.query(query, [user_id, token]);
            callback(null, result.rowCount);
        } catch (err) {
            callback(err, null);
        }
    },

    checkUserExists: async (username, callback) => {
        try {
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            callback(null, result.rows);
        } catch (err) {
            callback(err, null);
        }
    },

    register: async (fieldsToInsert, callback) => {
        const keys = [];
        const placeholders = [];
        const values = [];
        let paramCount = 1;

        for (const key in fieldsToInsert) {
            if (fieldsToInsert[key] !== undefined) {
                keys.push(key);
                placeholders.push(`$${paramCount}`);
                values.push(fieldsToInsert[key]);
                paramCount++;
            }
        }

        if (keys.length === 0) {
            throw new Error('No fields to insert');
        }

        const query = `INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

        console.log(query, values);

        try {
            const result = await pool.query(query, values);
            callback(null, result.rowCount);
        } catch (err) {
            callback(err, null);
        }
    }
};

module.exports = userModel;