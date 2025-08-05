-- Create tables for the memo management system
USE memo_system;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- hashed
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    designation VARCHAR(100),
    role ENUM('admin', 'staff') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);


-- project table
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    lokasi VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- Memos table
CREATE TABLE memos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    tarikh DATE NOT NULL,
    nama_aktiviti VARCHAR(100) NOT NULL,
    masa TIME NOT NULL,
    lokasi VARCHAR(100),
    created_by INT, -- admin user ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);


-- Memo_staff table
CREATE TABLE memo_staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    memo_id INT NOT NULL,
    staff_id INT NOT NULL,
    accepted BOOLEAN DEFAULT FALSE,
    accepted_at TIMESTAMP NULL,
    FOREIGN KEY (memo_id) REFERENCES memos(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);





-- Insert sample users
INSERT INTO users (username, password, name, department, designation, role, is_active, created_at, last_login)
VALUES
('admin_nina', 'hashed_pwd1', 'Nina Azman', 'PMO', 'Project Manager', 'admin', TRUE, NOW(), NOW()),
('staff_ali', 'hashed_pwd2', 'Ali Rahman', 'IT', 'Technician', 'staff', TRUE, NOW(), NOW()),
('staff_siti', 'hashed_pwd3', 'Siti Aminah', 'HR', 'Coordinator', 'staff', TRUE, NOW(), NOW());

-- Insert sample project
INSERT INTO projects (name, lokasi, created_at, updated_at)
VALUES
('Network Upgrade', 'HQ Building', NOW(), NOW()),
('Laptop Deployment', 'Branch A', NOW(), NOW());


-- Insert sample memos
INSERT INTO memos (project_id, tarikh, nama_aktiviti, masa, lokasi, created_by, created_at)
VALUES
(1, '2025-08-01', 'Server Maintenance', '09:00:00', 'HQ Server Room', 1, NOW()),
(2, '2025-08-03', 'Distribute Laptops', '14:00:00', 'Branch A Office', 1, NOW());


-- Insert sample memo_staff
INSERT INTO memo_staff (memo_id, staff_id, accepted, accepted_at)
VALUES
(1, 2, TRUE, '2025-07-28 10:30:00'),  -- Ali accepted
(1, 3, FALSE, NULL),                  -- Siti not accepted yet
(2, 2, TRUE, '2025-07-28 11:00:00');  -- Ali accepted another memo
