// server.js - Backend untuk E-Notulen dengan MySQL (Simplified)
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Konfigurasi MySQL Connection Pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',           
  password: '',           
  database: 'enotulen_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test koneksi database
pool.getConnection()
  .then(connection => {
    console.log('✅ Berhasil terhubung ke MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Error koneksi MySQL:', err.message);
    console.log('\n⚠️  Pastikan:');
    console.log('1. MySQL sudah running');
    console.log('2. Database "enotulen_db" sudah dibuat');
    console.log('3. Username dan password sudah benar\n');
  });

// ==================== ROUTES ====================

// 1. GET All Notulens
app.get('/api/notulens', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notulens ORDER BY startTime DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching notulens:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. GET Single Notulen by ID
app.get('/api/notulens/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notulens WHERE id = ?',
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notulen tidak ditemukan' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching notulen:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. POST Create New Notulen
app.post('/api/notulens', async (req, res) => {
  try {
    const {
      id,
      judulRapat,
      pimpinanRapat,
      notulensi,
      startTime,
      endTime,
      text,
      duration
    } = req.body;

    // Validasi
    if (!judulRapat || !text) {
      return res.status(400).json({ 
        error: 'Judul Rapat dan Text harus diisi' 
      });
    }

    // Fungsi untuk konversi ISO datetime ke MySQL format
    const formatDateTime = (isoString) => {
      if (!isoString) return null;
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    console.log('🔥 Data yang diterima:');
    console.log('startTime:', startTime);
    console.log('startTime formatted:', formatDateTime(startTime));
    console.log('endTime:', endTime);
    console.log('endTime formatted:', formatDateTime(endTime));

    const [result] = await pool.query(
      `INSERT INTO notulens (
        id, judulRapat, pimpinanRapat, notulensi,
        startTime, endTime, text, duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        judulRapat,
        pimpinanRapat || null,
        notulensi || null,
        formatDateTime(startTime),
        formatDateTime(endTime),
        text,
        duration || 0
      ]
    );

    console.log('✅ Data berhasil disimpan ke database');

    res.status(201).json({ 
      message: 'Notulen berhasil disimpan',
      id: id,
      insertId: result.insertId
    });
  } catch (error) {
    console.error('❌ Error creating notulen:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. PUT Update Notulen
app.put('/api/notulens/:id', async (req, res) => {
  try {
    const {
      judulRapat,
      pimpinanRapat,
      notulensi,
      text,
      duration
    } = req.body;

    const [result] = await pool.query(
      `UPDATE notulens SET 
        judulRapat = ?,
        pimpinanRapat = ?,
        notulensi = ?,
        text = ?,
        duration = ?
      WHERE id = ?`,
      [
        judulRapat,
        pimpinanRapat || null,
        notulensi || null,
        text,
        duration,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Notulen tidak ditemukan' });
    }

    res.json({ message: 'Notulen berhasil diupdate' });
  } catch (error) {
    console.error('Error updating notulen:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. DELETE Notulen
app.delete('/api/notulens/:id', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM notulens WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Notulen tidak ditemukan' });
    }

    res.json({ message: 'Notulen berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting notulen:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. GET Statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as totalNotulens,
        SUM(duration) as totalDuration,
        AVG(duration) as avgDuration,
        SUM(LENGTH(text) - LENGTH(REPLACE(text, ' ', '')) + 1) as totalWords
      FROM notulens
    `);
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

const { spawn } = require('child_process');

app.get('/api/stream/:cameraId', (req, res) => {
  const rtspUrl = 'rtsp://camera-url';
  const ffmpeg = spawn('ffmpeg', [
    '-i', rtspUrl,
    '-f', 'mpegts',
    '-codec:v', 'mpeg1video',
    '-'
  ]);
  
  ffmpeg.stdout.pipe(res);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'E-Notulen API is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   🚀 E-NOTULEN BACKEND SERVER         ║
║                                        ║
║   Server running on port ${PORT}         ║
║   API URL: http://localhost:${PORT}      ║
║                                        ║
║   Endpoints:                           ║
║   GET    /api/notulens                 ║
║   GET    /api/notulens/:id             ║
║   POST   /api/notulens                 ║
║   PUT    /api/notulens/:id             ║
║   DELETE /api/notulens/:id             ║
║   GET    /api/statistics               ║
║   GET    /api/health                   ║
╚═══════════════════════════════════════╝
  `);
});