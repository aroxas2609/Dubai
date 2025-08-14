const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class ReservationDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, 'reservations.db');
        this.db = null;
        this.init();
    }

    init() {
        try {
            // Create database file if it doesn't exist
            if (!fs.existsSync(this.dbPath)) {
                console.log('Creating new SQLite database file');
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    throw err;
                }
                console.log('✅ Connected to SQLite database');
                
                // Enable foreign keys and WAL mode for better performance
                this.db.run('PRAGMA foreign_keys = ON');
                this.db.run('PRAGMA journal_mode = WAL');
                
                this.createTables();
            });
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    createTables() {
        const createReservationsTable = `
            CREATE TABLE IF NOT EXISTS reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                activity TEXT NOT NULL,
                guests INTEGER,
                venue_name TEXT,
                venue_address TEXT,
                reservation_name TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const createIndexes = [
            'CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date)',
            'CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(time)',
            'CREATE INDEX IF NOT EXISTS idx_reservations_venue ON reservations(venue_name)'
        ];

        try {
            this.db.run(createReservationsTable, (err) => {
                if (err) {
                    console.error('Error creating reservations table:', err);
                    throw err;
                }
                console.log('✅ Reservations table created successfully');
                
                // Create indexes
                createIndexes.forEach((indexSQL, i) => {
                    this.db.run(indexSQL, (err) => {
                        if (err) {
                            console.error(`Error creating index ${i + 1}:`, err);
                        } else {
                            console.log(`✅ Index ${i + 1} created successfully`);
                        }
                    });
                });
                
                console.log('✅ Database tables and indexes created successfully');
            });
        } catch (error) {
            console.error('Error creating tables:', error);
            throw error;
        }
    }

    // Get all reservations for a specific date
    getReservationsByDate(date) {
        return new Promise((resolve, reject) => {
            try {
                const sql = `
                    SELECT * FROM reservations 
                    WHERE date = ? 
                    ORDER BY time ASC
                `;
                
                this.db.all(sql, [date], (err, rows) => {
                    if (err) {
                        console.error('Error getting reservations by date:', err);
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('Error in getReservationsByDate:', error);
                reject(error);
            }
        });
    }

    // Get a single reservation by ID
    getReservationById(id) {
        return new Promise((resolve, reject) => {
            try {
                this.db.get('SELECT * FROM reservations WHERE id = ?', [id], (err, row) => {
                    if (err) {
                        console.error('Error getting reservation by ID:', err);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            } catch (error) {
                console.error('Error in getReservationById:', error);
                reject(error);
            }
        });
    }

    // Add a new reservation
    addReservation(reservationData) {
        return new Promise((resolve, reject) => {
            try {
                const sql = `
                    INSERT INTO reservations (
                        date, time, activity, guests, venue_name, 
                        venue_address, reservation_name, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;

                this.db.run(sql, [
                    reservationData.date,
                    reservationData.time,
                    reservationData.activity,
                    reservationData.guests || null,
                    reservationData.venueName || null,
                    reservationData.venueAddress || null,
                    reservationData.reservationName || null,
                    reservationData.notes || null
                ], function(err) {
                    if (err) {
                        console.error('Error adding reservation:', err);
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            ...reservationData
                        });
                    }
                });
            } catch (error) {
                console.error('Error in addReservation:', error);
                reject(error);
            }
        });
    }

    // Update an existing reservation
    updateReservation(id, reservationData) {
        return new Promise((resolve, reject) => {
            try {
                const sql = `
                    UPDATE reservations SET 
                        date = ?, time = ?, activity = ?, guests = ?, 
                        venue_name = ?, venue_address = ?, reservation_name = ?, 
                        notes = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `;

                this.db.run(sql, [
                    reservationData.date,
                    reservationData.time,
                    reservationData.activity,
                    reservationData.guests || null,
                    reservationData.venueName || null,
                    reservationData.venueAddress || null,
                    reservationData.reservationName || null,
                    reservationData.notes || null,
                    id
                ], function(err) {
                    if (err) {
                        console.error('Error updating reservation:', err);
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                });
            } catch (error) {
                console.error('Error in updateReservation:', error);
                reject(error);
            }
        });
    }

    // Delete a reservation
    deleteReservation(id) {
        return new Promise((resolve, reject) => {
            try {
                this.db.run('DELETE FROM reservations WHERE id = ?', [id], function(err) {
                    if (err) {
                        console.error('Error deleting reservation:', err);
                        reject(err);
                    } else {
                        resolve(this.changes > 0);
                    }
                });
            } catch (error) {
                console.error('Error in deleteReservation:', error);
                reject(error);
            }
        });
    }

    // Get all reservations (for admin purposes)
    getAllReservations() {
        return new Promise((resolve, reject) => {
            try {
                const sql = `
                    SELECT * FROM reservations 
                    ORDER BY date ASC, time ASC
                `;
                
                this.db.all(sql, (err, rows) => {
                    if (err) {
                        console.error('Error getting all reservations:', err);
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('Error in getAllReservations:', error);
                reject(error);
            }
        });
    }

    // Search reservations by venue name
    searchReservationsByVenue(venueName) {
        return new Promise((resolve, reject) => {
            try {
                const sql = `
                    SELECT * FROM reservations 
                    WHERE venue_name LIKE ? 
                    ORDER BY date ASC, time ASC
                `;
                
                this.db.all(sql, [`%${venueName}%`], (err, rows) => {
                    if (err) {
                        console.error('Error searching reservations by venue:', err);
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('Error in searchReservationsByVenue:', error);
                reject(error);
            }
        });
    }

    // Get reservations within a date range
    getReservationsByDateRange(startDate, endDate) {
        return new Promise((resolve, reject) => {
            try {
                const sql = `
                    SELECT * FROM reservations 
                    WHERE date >= ? AND date <= ? 
                    ORDER BY date ASC, time ASC
                `;
                
                this.db.all(sql, [startDate, endDate], (err, rows) => {
                    if (err) {
                        console.error('Error getting reservations by date range:', err);
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                });
            } catch (error) {
                console.error('Error in getReservationsByDateRange:', error);
                reject(error);
            }
        });
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close();
            console.log('Database connection closed');
        }
    }

    // Backup database
    backup(backupPath) {
        return new Promise((resolve, reject) => {
            try {
                const backupDb = new sqlite3.Database(backupPath, (err) => {
                    if (err) {
                        console.error('Error creating backup database:', err);
                        reject(err);
                        return;
                    }
                    
                    // For now, we'll just copy the file since sqlite3 doesn't have built-in backup
                    const fs = require('fs');
                    try {
                        fs.copyFileSync(this.dbPath, backupPath);
                        backupDb.close();
                        console.log(`Database backed up to: ${backupPath}`);
                        resolve(true);
                    } catch (copyError) {
                        backupDb.close();
                        reject(copyError);
                    }
                });
            } catch (error) {
                console.error('Error in backup:', error);
                reject(error);
            }
        });
    }

    // Get database statistics
    getStats() {
        return new Promise((resolve, reject) => {
            try {
                this.db.get('SELECT COUNT(*) as count FROM reservations', (err, totalResult) => {
                    if (err) {
                        console.error('Error getting total reservations count:', err);
                        reject(err);
                        return;
                    }
                    
                    this.db.get(`
                        SELECT 
                            MIN(date) as earliest_date,
                            MAX(date) as latest_date
                        FROM reservations
                    `, (err, dateRangeResult) => {
                        if (err) {
                            console.error('Error getting date range:', err);
                            reject(err);
                            return;
                        }
                        
                        resolve({
                            totalReservations: totalResult.count,
                            dateRange: dateRangeResult
                        });
                    });
                });
            } catch (error) {
                console.error('Error in getStats:', error);
                reject(error);
            }
        });
    }
}

// Create and export a singleton instance
const reservationDB = new ReservationDatabase();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down database...');
    reservationDB.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down database...');
    reservationDB.close();
    process.exit(0);
});

module.exports = reservationDB; 