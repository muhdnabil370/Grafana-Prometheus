const express = require('express');
const mysql = require('mysql2/promise');
const promClient = require('prom-client');
const path = require('path');

const app = express();
const port = 3000;

// Enable default metrics collection (KEEP THIS - Important for monitoring)
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// Custom metrics (KEEP THESE - Your supervisor will love the monitoring data)
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

// NEW: Dashboard view metrics
const dashboardViews = new promClient.Counter({
  name: 'dashboard_views_total',
  help: 'Total number of dashboard views',
  labelNames: ['dashboard_type']
});

// Database configuration (KEEP - Better connection pooling)
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

// Initialize database connection (KEEP THIS - Much better than single connections)
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

// Update memo-related metrics (KEEP - Important for Grafana)
async function updateMemoMetrics() {
  try {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM memos WHERE status = "sent"');
    activeMemos.set(rows[0].count);
  } catch (error) {
    console.error('Error updating memo metrics:', error);
  }
}

// Middleware for request duration tracking (KEEP)
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

// NEW: Add EJS and static files support
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Health check endpoint (KEEP)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint for Prometheus (KEEP - Essential for monitoring)
app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  promClient.register.metrics().then(metrics => {
    res.end(metrics);
  });
});

// NEW: Home route with dashboard links
app.get('/', (req, res) => {
  try {
    res.send(`
      <html>
        <head>
          <title>Memo Management System</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; }
            ul { list-style: none; padding: 0; }
            li { margin: 10px 0; }
            a { color: #007bff; text-decoration: none; padding: 8px 15px; background: #f8f9fa; border-radius: 5px; display: inline-block; }
            a:hover { background: #007bff; color: white; }
            .dashboard-links { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
            .dashboard-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }
            .dashboard-card a { color: white; background: rgba(255,255,255,0.2); }
            .dashboard-card a:hover { background: rgba(255,255,255,0.3); }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📊 Memo Management System</h1>
            
            <div class="dashboard-links">
              <div class="dashboard-card">
                <h3>👨‍💼 Admin Dashboard</h3>
                <p>Analytics & Management</p>
                <a href="/admin/dashboard">View Dashboard</a>
              </div>
              <div class="dashboard-card">
                <h3>👩‍💻 Staff Dashboard</h3>
                <p>My Assignments</p>
                <a href="/staff/dashboard">View Dashboard</a>
              </div>
            </div>
            
            <h2>🔧 API Endpoints:</h2>
            <ul>
              <li><a href="/health">Health Check</a></li>
              <li><a href="/metrics">Prometheus Metrics</a></li>
              <li><a href="/api/memos">All Memos (API)</a></li>
              <li><a href="/api/memo-stats">Memo Statistics (API)</a></li>
              <li><a href="/api/users/2/assignments">User 2 Assignments (API)</a></li>
              <li><a href="/api/users/2/notifications">User 2 Notifications (API)</a></li>
            </ul>
            
            <h2>🌐 External Services:</h2>
            <ul>
              <li><a href="http://localhost:9090" target="_blank">Prometheus (Port 9090)</a></li>
              <li><a href="http://localhost:3001" target="_blank">Grafana (Port 3001)</a></li>
            </ul>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error rendering home page:', error);
    res.status(500).send('Server Error');
  }
});

// NEW: Admin Dashboard with Embedded Grafana
app.get('/admin/dashboard', (req, res) => {
  try {
    dashboardViews.labels('admin').inc(); // Track dashboard views
    res.render('admin-dashboard');
  } catch (error) {
    console.error('Error rendering admin dashboard:', error);
    res.status(500).send('Dashboard Error');
  }
});

// NEW: Staff Dashboard
app.get('/staff/dashboard', (req, res) => {
  try {
    dashboardViews.labels('staff').inc(); // Track dashboard views
    res.render('staff-dashboard');
  } catch (error) {
    console.error('Error rendering staff dashboard:', error);
    res.status(500).send('Dashboard Error');
  }
});

// ENHANCED: API endpoint for memo statistics (using connection pool)
app.get('/api/memo-stats', async (req, res) => {
  try {
    dbConnectionsTotal.inc();
    memoOperationsTotal.labels('get_stats', 'attempt').inc();
    
    const [todayMemos] = await pool.execute(
      'SELECT COUNT(*) as count FROM memos WHERE DATE(created_at) = CURDATE()'
    );
    
    const [totalMemos] = await pool.execute(
      'SELECT COUNT(*) as count FROM memos WHERE status = "active"'
    );
    
    const [weeklyTrend] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM memos 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    
    memoOperationsTotal.labels('get_stats', 'success').inc();
    
    res.json({
      todayMemos: todayMemos[0].count,
      totalMemos: totalMemos[0].count,
      weeklyTrend: weeklyTrend
    });
  } catch (error) {
    memoOperationsTotal.labels('get_stats', 'error').inc();
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// KEEP: Get all memos (for admin) - Your existing API
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

// KEEP: Get memo assignments for a user
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

// KEEP: Accept memo assignment
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

// KEEP: Get notifications for a user
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

// Start server after database initialization (KEEP THIS PATTERN)
initializeDatabase().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Memo management app listening at http://localhost:${port}`);
    console.log(`Admin Dashboard: http://localhost:${port}/admin/dashboard`);
    console.log(`Staff Dashboard: http://localhost:${port}/staff/dashboard`);
    console.log(`Grafana: http://localhost:3001`);
    console.log(`Prometheus: http://localhost:9090`);
  });
  
  // Update metrics every 30 seconds (KEEP)
  setInterval(updateMemoMetrics, 30000);
}).catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = app;