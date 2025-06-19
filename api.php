<?php
// 引入数据库配置
require_once 'db_config.php';

// 设置响应头
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // 允许任何来源的跨域请求
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// 解决中文乱码问题
$conn->query("SET NAMES utf8mb4");

// 获取请求方法和操作类型
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

// 根据请求方法和操作类型处理不同的业务逻辑
if ($method === 'GET') {
    // 处理GET请求
    switch ($action) {
        case 'getSession':
            getSession();
            break;
        case 'getGlobalSession':
            getGlobalSession();
            break;
        default:
            send_error('无效的操作');
            break;
    }
} elseif ($method === 'POST') {
    // 处理POST请求
    switch ($action) {
        case 'createSession':
            createSession();
            break;
        case 'updateSession':
            updateSession();
            break;
        case 'createGlobalSession':
            createGlobalSession();
            break;
        case 'updateGlobalSessionWithGameId':
            updateGlobalSessionWithGameId();
            break;
        default:
            send_error('无效的操作');
            break;
    }
} else {
    send_error('不支持的请求方法');
}

// 获取会话数据
function getSession() {
    global $conn;
    
    // 获取会话ID
    $sessionId = isset($_GET['session_id']) ? $_GET['session_id'] : '';
    if (empty($sessionId)) {
        send_error('会话ID不能为空');
        return;
    }
    
    // 查询数据库
    $stmt = $conn->prepare("SELECT * FROM bp_sessions WHERE session_id = ?");
    $stmt->bind_param("s", $sessionId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        send_error('会话不存在');
        return;
    }
    
    // 获取会话数据
    $sessionData = $result->fetch_assoc();
    
    // 处理数组字段
    $sessionData['blue_bans'] = !empty($sessionData['blue_bans']) ? json_decode($sessionData['blue_bans']) : [];
    $sessionData['red_bans'] = !empty($sessionData['red_bans']) ? json_decode($sessionData['red_bans']) : [];
    $sessionData['blue_picks'] = !empty($sessionData['blue_picks']) ? json_decode($sessionData['blue_picks']) : [];
    $sessionData['red_picks'] = !empty($sessionData['red_picks']) ? json_decode($sessionData['red_picks']) : [];
    
    // 返回数据
    send_response($sessionData);
}

// 创建新会话
function createSession() {
    global $conn;
    
    // 解析POST数据
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        send_error('无效的请求数据');
        return;
    }
    
    // 获取必要字段
    $sessionId = isset($data['session_id']) ? $data['session_id'] : '';
    $currentMode = isset($data['current_mode']) ? $data['current_mode'] : '';
    
    if (empty($sessionId) || empty($currentMode)) {
        send_error('必填字段不能为空');
        return;
    }
    
    // 准备其他字段
    $currentPhase = isset($data['current_phase']) ? $data['current_phase'] : '';
    $currentStep = isset($data['current_step']) ? intval($data['current_step']) : 0;
    $whosTurn = isset($data['whos_turn']) ? $data['whos_turn'] : '';
    $actionType = isset($data['action_type']) ? $data['action_type'] : '';
    
    // 数组字段转为JSON
    $blueBans = isset($data['blue_bans']) ? json_encode($data['blue_bans']) : '[]';
    $redBans = isset($data['red_bans']) ? json_encode($data['red_bans']) : '[]';
    $bluePicks = isset($data['blue_picks']) ? json_encode($data['blue_picks']) : '[]';
    $redPicks = isset($data['red_picks']) ? json_encode($data['red_picks']) : '[]';
    $systemBannedChampions = isset($data['system_banned_champions']) ? json_encode($data['system_banned_champions']) : '[]';
    
    // 插入数据
    $stmt = $conn->prepare("INSERT INTO bp_sessions (
        session_id, 
        current_mode, 
        current_phase, 
        current_step, 
        whos_turn, 
        action_type, 
        blue_bans, 
        red_bans, 
        blue_picks, 
        red_picks,
        system_banned_champions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $stmt->bind_param("sssississss", 
        $sessionId, 
        $currentMode, 
        $currentPhase, 
        $currentStep, 
        $whosTurn, 
        $actionType, 
        $blueBans, 
        $redBans, 
        $bluePicks, 
        $redPicks,
        $systemBannedChampions
    );
    
    if ($stmt->execute()) {
        send_response(['session_id' => $sessionId, 'message' => '会话创建成功']);
    } else {
        send_error('创建会话失败: ' . $stmt->error);
    }
}

// 更新会话数据
function updateSession() {
    global $conn;
    
    // 解析POST数据
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        send_error('无效的请求数据');
        return;
    }
    
    // 获取会话ID
    $sessionId = isset($data['session_id']) ? $data['session_id'] : '';
    if (empty($sessionId)) {
        send_error('会话ID不能为空');
        return;
    }
    
    // 确认会话是否存在
    $stmt = $conn->prepare("SELECT 1 FROM bp_sessions WHERE session_id = ?");
    $stmt->bind_param("s", $sessionId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        send_error('会话不存在');
        return;
    }
    
    // 准备更新字段
    $currentMode = isset($data['current_mode']) ? $data['current_mode'] : '';
    $currentPhase = isset($data['current_phase']) ? $data['current_phase'] : '';
    $currentStep = isset($data['current_step']) ? intval($data['current_step']) : 0;
    $whosTurn = isset($data['whos_turn']) ? $data['whos_turn'] : '';
    $actionType = isset($data['action_type']) ? $data['action_type'] : '';
    
    // 数组字段转为JSON
    $blueBans = isset($data['blue_bans']) ? json_encode($data['blue_bans']) : '[]';
    $redBans = isset($data['red_bans']) ? json_encode($data['red_bans']) : '[]';
    $bluePicks = isset($data['blue_picks']) ? json_encode($data['blue_picks']) : '[]';
    $redPicks = isset($data['red_picks']) ? json_encode($data['red_picks']) : '[]';
    
    // 新增：系统禁用英雄列表
    $systemBannedChampions = isset($data['system_banned_champions']) ? json_encode($data['system_banned_champions']) : '[]';
    
    // 记录操作来源
    $userRole = isset($data['user_role']) ? $data['user_role'] : 'unknown';
    
    // 更新数据 - 添加系统禁用英雄列表字段
    $stmt = $conn->prepare("UPDATE bp_sessions SET 
        current_mode = ?, 
        current_phase = ?, 
        current_step = ?, 
        whos_turn = ?, 
        action_type = ?, 
        blue_bans = ?, 
        red_bans = ?, 
        blue_picks = ?, 
        red_picks = ?,
        system_banned_champions = ? 
        WHERE session_id = ?");
    
    $stmt->bind_param("ssissssssss", 
        $currentMode, 
        $currentPhase, 
        $currentStep, 
        $whosTurn, 
        $actionType, 
        $blueBans, 
        $redBans, 
        $bluePicks, 
        $redPicks,
        $systemBannedChampions,
        $sessionId
    );
    
    if ($stmt->execute()) {
        // 记录操作
        $action = isset($data['action']) ? $data['action'] : 'update';
        $actionData = json_encode($data);
        $activityStmt = $conn->prepare("INSERT INTO session_activity (session_id, action, action_by, action_data) VALUES (?, ?, ?, ?)");
        $activityStmt->bind_param("ssss", $sessionId, $action, $userRole, $actionData);
        $activityStmt->execute();
        
        send_response(['session_id' => $sessionId, 'message' => '会话更新成功']);
    } else {
        send_error('更新会话失败: ' . $stmt->error);
    }
}

// 创建全局会话记录
function createGlobalSession() {
    global $conn;
    
    // 解析POST数据
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        send_error('无效的请求数据');
        return;
    }
    
    // 获取全局会话ID
    $globalSessionId = isset($data['global_session_id']) ? $data['global_session_id'] : '';
    if (empty($globalSessionId)) {
        send_error('全局会话ID不能为空');
        return;
    }
    
    // 检查表是否存在，如果不存在则创建
    $tableCheck = $conn->query("SHOW TABLES LIKE 'global_games'");
    if ($tableCheck->num_rows == 0) {
        // 创建全局游戏表 - 完全修复TIMESTAMP问题
        $createTableSql = "CREATE TABLE global_games (
            id INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            global_session_id VARCHAR(50) NOT NULL UNIQUE,
            session_id1 VARCHAR(50) NULL,
            session_id2 VARCHAR(50) NULL,
            session_id3 VARCHAR(50) NULL,
            session_id4 VARCHAR(50) NULL,
            session_id5 VARCHAR(50) NULL,
            created_at DATETIME NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )";
        
        if (!$conn->query($createTableSql)) {
            send_error('创建全局游戏表失败: ' . $conn->error);
            return;
        }
    }
    
    // 获取当前时间
    $now = date("Y-m-d H:i:s");
    
    // 插入数据
    $stmt = $conn->prepare("INSERT INTO global_games (global_session_id, created_at) VALUES (?, ?)");
    $stmt->bind_param("ss", $globalSessionId, $now);
    
    if ($stmt->execute()) {
        send_response(['global_session_id' => $globalSessionId, 'message' => '全局会话创建成功']);
    } else {
        send_error('创建全局会话失败: ' . $stmt->error);
    }
}

// 更新全局会话中的游戏ID
function updateGlobalSessionWithGameId() {
    global $conn;
    
    // 解析POST数据
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        send_error('无效的请求数据');
        return;
    }
    
    // 获取全局会话ID和游戏编号
    $globalSessionId = isset($data['global_session_id']) ? $data['global_session_id'] : '';
    $gameNumber = isset($data['game_number']) ? intval($data['game_number']) : 0;
    $sessionId = isset($data['session_id']) ? $data['session_id'] : '';
    
    if (empty($globalSessionId) || $gameNumber <= 0 || $gameNumber > 5 || empty($sessionId)) {
        send_error('参数错误：全局会话ID不能为空，游戏编号必须在1-5之间，会话ID不能为空');
        return;
    }
    
    // 确认全局会话是否存在
    $stmt = $conn->prepare("SELECT 1 FROM global_games WHERE global_session_id = ?");
    $stmt->bind_param("s", $globalSessionId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        send_error('全局会话不存在');
        return;
    }
    
    // 构建字段名
    $fieldName = "session_id" . $gameNumber;
    
    // 更新数据
    $updateSql = "UPDATE global_games SET $fieldName = ? WHERE global_session_id = ?";
    $updateStmt = $conn->prepare($updateSql);
    $updateStmt->bind_param("ss", $sessionId, $globalSessionId);
    
    if ($updateStmt->execute()) {
        send_response([
            'global_session_id' => $globalSessionId, 
            'game_number' => $gameNumber, 
            'session_id' => $sessionId, 
            'message' => '全局会话游戏ID更新成功'
        ]);
    } else {
        send_error('更新全局会话游戏ID失败: ' . $updateStmt->error);
    }
}

// 获取全局会话数据
function getGlobalSession() {
    global $conn;
    
    // 获取全局会话ID
    $globalSessionId = isset($_GET['global_session_id']) ? $_GET['global_session_id'] : '';
    if (empty($globalSessionId)) {
        send_error('全局会话ID不能为空');
        return;
    }
    
    // 检查表是否存在
    $tableCheck = $conn->query("SHOW TABLES LIKE 'global_games'");
    if ($tableCheck->num_rows == 0) {
        send_error('全局游戏表不存在');
        return;
    }
    
    // 查询数据库
    $stmt = $conn->prepare("SELECT * FROM global_games WHERE global_session_id = ?");
    $stmt->bind_param("s", $globalSessionId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        send_error('全局会话不存在');
        return;
    }
    
    // 获取会话数据
    $globalSessionData = $result->fetch_assoc();
    
    // 返回数据
    send_response($globalSessionData);
}

// 发送成功响应
function send_response($data) {
    echo json_encode([
        'status' => 'success',
        'data' => $data
    ]);
    exit;
}

// 发送错误响应
function send_error($message) {
    echo json_encode([
        'status' => 'error',
        'message' => $message
    ]);
    exit;
}
?> 