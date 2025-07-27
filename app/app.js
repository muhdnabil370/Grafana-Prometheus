const express = require('express');
const mysql = require('mysql2/promise');
const promClient = require('prom-client');

const app = express();
const port = 3000;

// Enable default metrics collection
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const dbConnectionsTotal = new promClient.Counter({
  name: 'db_connections_total',
  help: 'Total number of database connections'
});

const memoOperationsTotal = new promClient.Counter({
  name: 'memo_operations_total',
  help: 'Total number of memo operations',
  labelNames: ['operation', 'status']
});

const activeMemos = new promClient.Gauge({
  name: 'active_memos_count',
  help: 'Number of active memos in the system'
});

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  user: process.env.DB_USER || 'memo_user',
  password: process.env.DB_PASSWORD || 'memo_pass',
  database: process.env.DB_NAME || 'memo_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

// Initialize database connection
async function initializeDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    console.log('Database connection pool created');
    
    // Test connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('Database connection successful');
    
    // Update metrics
    updateMemoMetrics();
    
  } catch (error) {
    console.error('Database connection error:', error);
    setTimeout(initializeDatabase, 5000); // Retry after 5 seconds
  }
}

// Update memo-related metrics
async function updateMemoMetrics() {
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM memos WHERE status = "sent"');
    activeMemos.set(rows[0].count);
  } catch (error) {
    console.error('Error updating memo metrics:', error);
  }
}

// Middleware for request duration tracking
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const end = Date.now();
    const duration = (end - start) / 1000; // Convert to seconds
    
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  promClient.register.metrics().then(metrics => {
    res.end(metrics);
  });
});

// Get all memos (for admin)
app.get('/api/memos', async (req, res) => {
  try {
    dbConnectionsTotal.inc();
    memoOperationsTotal.labels('get_all', 'attempt').inc();
    
    const [rows] = await pool.execute(`
      SELECT m.*, u.full_name as created_by_name, p.project_name
      FROM memos m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN projects p ON m.project_id = p.id
      ORDER BY m.created_at DESC
    `);
    
    memoOperationsTotal.labels('get_all', 'success').inc();
    res.json(rows);
  } catch (error) {
    memoOperationsTotal.labels('get_all', 'error').inc();
    console.error('Error fetching memos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get memo assignments for a user
app.get('/api/users/:userId/assignments', async (req, res) => {
  try {
    dbConnectionsTotal.inc();
    memoOperationsTotal.labels('get_assignments', 'attempt').inc();
    
    const userId = req.params.userId;
    const [rows] = await pool.execute(`
      SELECT ma.*, m.title, m.content, m.deadline, m.priority,
             u.full_name as assigned_by_name
      FROM memo_assignments ma
      JOIN memos m ON ma.memo_id = m.id
      JOIN users u ON ma.assigned_by = u.id
      WHERE ma.assigned_to = ?
      ORDER BY ma.assigned_at DESC
    `, [userId]);
    
    memoOperationsTotal.labels('get_assignments', 'success').inc();
    res.json(rows);
  } catch (error) {
    memoOperationsTotal.labels('get_assignments', 'error').inc();
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept memo assignment
app.put('/api/assignments/:assignmentId/accept', async (req, res) => {
  try {
    dbConnectionsTotal.inc();
    memoOperationsTotal.labels('accept_memo', 'attempt').inc();
    
    const assignmentId = req.params.assignmentId;
    const [result] = await pool.execute(`
      UPDATE memo_assignments 
      SET status = 'accepted', accepted_at = NOW() 
      WHERE id = ?
    `, [assignmentId]);
    
    if (result.affectedRows > 0) {
      memoOperationsTotal.labels('accept_memo', 'success').inc();
      res.json({ message: 'Memo accepted successfully' });
      
      // Update metrics
      updateMemoMetrics();
    } else {
      memoOperationsTotal.labels('accept_memo', 'not_found').inc();
      res.status(404).json({ error: 'Assignment not found' });
    }
  } catch (error) {
    memoOperationsTotal.labels('accept_memo', 'error').inc();
    console.error('Error accepting memo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notifications for a user
app.get('/api/users/:userId/notifications', async (req, res) => {
  try {
    dbConnectionsTotal.inc();
    
    const userId = req.params.userId;
    const [rows] = await pool.execute(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [userId]);
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple dashboard endpoint
app.get('/', (req, res) => {
  res.send(`
    <h1>Memo Management System</h1>
    <h2>Available Endpoints:</h2>
    <ul>
      <li><a href="/health">Health Check</a></li>
      <li><a href="/metrics">Prometheus Metrics</a></li>
      <li><a href="/api/memos">All Memos (API)</a></li>
      <li><a href="/api/users/2/assignments">User 2 Assignments (API)</a></li>
      <li><a href="/api/users/2/notifications">User 2 Notifications (API)</a></li>
    </ul>
    <h2>External Services:</h2>
    <ul>
      <li><a href="http://localhost:9090" target="_blank">Prometheus (Port 9090)</a></li>
      <li><a href="http://localhost:3001" target="_blank">Grafana (Port 3001)</a></li>
    </ul>
  `);
});

// Start server after database initialization
initializeDatabase().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Memo management app listening at http://localhost:${port}`);
  });
  
  // Update metrics every 30 seconds
  setInterval(updateMemoMetrics, 30000);
}).catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});