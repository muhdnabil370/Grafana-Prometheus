-- Create tables for the memo management system
USE memo_system;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Roles table
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User roles junction table
CREATE TABLE user_roles (
    user_id INT,
    role_id INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Projects table
CREATE TABLE projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive', 'completed') DEFAULT 'active',
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Memos table
CREATE TABLE memos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    project_id INT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('draft', 'sent', 'archived') DEFAULT 'draft',
    deadline DATE,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Memo assignments table
CREATE TABLE memo_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    memo_id INT NOT NULL,
    assigned_to INT NOT NULL,
    assigned_by INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'accepted', 'rejected', 'completed') DEFAULT 'pending',
    accepted_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    notes TEXT,
    FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);

-- Notifications table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    memo_id INT,
    notification_type ENUM('memo_assigned', 'memo_updated', 'deadline_reminder', 'system') DEFAULT 'memo_assigned',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
);

-- Activity logs table (optional)
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert sample roles
INSERT INTO roles (role_name, description) VALUES 
('admin', 'System administrator with full access'),
('staff', 'Regular staff member');

-- Insert sample users
INSERT INTO users (username, email, password_hash, full_name) VALUES 
('admin', 'admin@memo.com', '$2b$10$example_hash_admin', 'System Administrator'),
('john_doe', 'john@memo.com', '$2b$10$example_hash_john', 'John Doe'),
('jane_smith', 'jane@memo.com', '$2b$10$example_hash_jane', 'Jane Smith');

-- Assign roles to users
INSERT INTO user_roles (user_id, role_id) VALUES 
(1, 1), -- admin user gets admin role
(2, 2), -- john gets staff role
(3, 2); -- jane gets staff role

-- Insert sample project
INSERT INTO projects (project_name, description, created_by) VALUES 
('Q1 2025 Planning', 'First quarter planning and coordination', 1);

-- Insert sample memos
INSERT INTO memos (title, content, project_id, created_by, priority, status) VALUES 
('Welcome Memo', 'Welcome to the new memo system. Please review and accept this memo.', 1, 1, 'high', 'sent'),
('Monthly Report Due', 'Please submit your monthly reports by the end of this week.', 1, 1, 'medium', 'sent');

-- Insert sample memo assignments
INSERT INTO memo_assignments (memo_id, assigned_to, assigned_by, status) VALUES 
(1, 2, 1, 'pending'),
(1, 3, 1, 'accepted'),
(2, 2, 1, 'pending'),
(2, 3, 1, 'pending');

-- Insert sample notifications
INSERT INTO notifications (user_id, memo_id, notification_type, title, message) VALUES 
(2, 1, 'memo_assigned', 'New Memo Assigned', 'You have been assigned a new memo: Welcome Memo'),
(3, 1, 'memo_assigned', 'New Memo Assigned', 'You have been assigned a new memo: Welcome Memo'),
(2, 2, 'memo_assigned', 'New Memo Assigned', 'You have been assigned a new memo: Monthly Report Due'),
(3, 2, 'memo_assigned', 'New Memo Assigned', 'You have been assigned a new memo: Monthly Report Due');

-- Insert sample activity logs
INSERT INTO activity_logs (user_id, action, table_name, record_id, new_values) VALUES 
(1, 'CREATE_MEMO', 'memos', 1, '{"title": "Welcome Memo", "priority": "high"}'),
(1, 'ASSIGN_MEMO', 'memo_assignments', 1, '{"memo_id": 1, "assigned_to": 2}'),
(3, 'ACCEPT_MEMO', 'memo_assignments', 2, '{"status": "accepted"}');