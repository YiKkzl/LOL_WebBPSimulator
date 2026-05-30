-- 创建表结构
CREATE TABLE IF NOT EXISTS bp_sessions (
    session_id VARCHAR(20) PRIMARY KEY,
    current_mode VARCHAR(20),
    current_phase VARCHAR(20),
    current_step INT,
    whos_turn VARCHAR(10),
    action_type VARCHAR(10),
    pending_champion_id VARCHAR(64),
    blue_bans TEXT,
    red_bans TEXT, 
    blue_picks TEXT,
    red_picks TEXT,
    system_banned_champions TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建会话活动记录表
CREATE TABLE IF NOT EXISTS session_activity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(20),
    action VARCHAR(50),
    action_by VARCHAR(20),
    action_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES bp_sessions(session_id)
);
