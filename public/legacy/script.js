// --- Data ---
// IMPORTANT: Replace with actual Data Dragon version and potentially fetch dynamically
// const DATA_DRAGON_VERSION = "15.8.1"; // Example version, check for latest - REMOVED
// const championData = [ ... ]; - REMOVED

// --- State Variables ---
let latestVersion = ""; // Will be fetched
let allChampionData = []; // Will be fetched

// 全局模式相关变量
let globalModeSessionId = null; // 全局会话ID
let previousGamesPicks = {}; // 存储前面对局的选择，格式: {gameNumber: {blue: [], red: []}}
let currentGameNumber = 0; // 当前游戏编号

let currentMode = null; // 'ranked' or 'competitive'
let currentPhase = ''; // e.g., 'ban1', 'pick1', 'ban2', 'pick2'
let currentStep = 0; // Index within the overall BP sequence
let whosTurn = ''; // 'blue' or 'red'
let actionType = ''; // 'ban' or 'pick'

let blueBans = [];
let redBans = [];
let bluePicks = [];
let redPicks = [];

let bannedChampions = new Set();
let pickedChampions = new Set();

let timerInterval = null;
let timerValue = 30; // Default timer duration

let pendingChampionId = null; // <-- Add state for pending selection

// Session variables
let sessionId = null;
let userRole = 'host'; // 'host', 'blue', 'red', 'observer', 'referee'
let isSessionActive = false;
let lastPollTime = 0; // Last time session data was polled

// 裁判禁用的英雄列表
let systemBannedChampions = [];

// API endpoints - Replace with your actual API URL
const API_BASE_URL = '/api.php'; // 相对路径，确保API文件在正确位置

// --- DOM Elements ---
const modeSelectionDiv = document.getElementById('mode-selection');
const bpInterfaceDiv = document.getElementById('bp-interface');
const initialScreenContainer = document.getElementById('initial-screen-container'); // 新增：获取初始屏幕容器
const modeTitleEl = document.getElementById('mode-title');
const currentActionEl = document.getElementById('current-action');
const timerValueEl = document.getElementById('timer-value');
const blueBansDiv = document.getElementById('blue-bans');
const redBansDiv = document.getElementById('red-bans');
const bluePicksDiv = document.getElementById('blue-picks');
const redPicksDiv = document.getElementById('red-picks');
const championPoolDiv = document.getElementById('champion-pool');
const searchBox = document.getElementById('search-box');
const pendingChampionEl = document.getElementById('pending-champion'); // <-- Get pending element
const confirmButtonEl = document.getElementById('confirm-button'); // <-- Get confirm button
const emptyBanButtonEl = document.getElementById('empty-ban-button'); // <-- Get empty ban button
const shareLinksDivEl = document.getElementById('share-links'); // Will be created
const gameSelectionDiv = document.getElementById('game-selection');
const currentGameEl = document.getElementById('current-game');
const gameIndicatorDiv = document.getElementById('game-indicator');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch latest version and champion data on page load
    await initializeData();
    
    // 清理过期的游戏完成标记
    cleanupGameCompletionFlags();
    
    // Check URL for session and role parameters
    checkSessionParameters();
    
    // Check if we need to directly start a global game or show distribution page
    checkDistributePage();
    
    // 性能优化：为英雄池添加事件委托
    championPoolDiv.addEventListener('click', handleChampionPoolClick);
    
    // 需求：创建通过ID观战的UI
    createObserverJoinUI();
    
    // 需求：修改按钮颜色
    applyCustomButtonStyles();
    
    // Log status for debugging
    console.log("Champion data loaded.");
});

// 清理过期的游戏完成标记
function cleanupGameCompletionFlags() {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
        if (key.startsWith('game_') && key.endsWith('_completed')) {
            const gameNumber = key.match(/game_(\d+)_completed/);
            if (gameNumber) {
                console.log(`清理Game ${gameNumber[1]}的完成标记`);
                sessionStorage.removeItem(key);
            }
        }
    });
}

// --- New Function to Fetch Data ---
async function initializeData() {
    try {
        // 1. 获取最新版本
        const versionResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        if (!versionResponse.ok) throw new Error(`HTTP error! status: ${versionResponse.status}`);
        const versions = await versionResponse.json();
        latestVersion = versions[0]; // 获取最新版本
        console.log("最新 Data Dragon 版本:", latestVersion);

        // 2. 使用最新版本获取中文英雄数据
        const champDataUrl = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/zh_CN/champion.json`;
        const championResponse = await fetch(champDataUrl);
        if (!championResponse.ok) throw new Error(`HTTP error! status: ${championResponse.status}`);
        const championJson = await championResponse.json();

        // 3. 处理英雄数据，添加ID、中文名、称号和标签
        allChampionData = Object.values(championJson.data).map(champ => ({
            id: champ.id,           // 英雄ID (如 "Aatrox")
            name: champ.name,       // 中文名称 (如 "暗裔剑魔")
            title: champ.title,     // 称号 (如 "亚托克斯")
            key: champ.key,         // 数字ID
            tags: champ.tags,       // 角色类型标签 (如 ["Fighter", "Tank"])
            searchTerms: `${champ.id} ${champ.name} ${champ.title}`.toLowerCase() // 用于搜索的组合文本
        }));
        
        // 按中文名称排序
        allChampionData.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

        // 4. 提取所有可能的标签
        const allTags = new Set();
        allChampionData.forEach(champ => {
            champ.tags.forEach(tag => allTags.add(tag));
        });
        
        // 5. 创建标签按钮
        createTagFilterButtons(Array.from(allTags));

        console.log(`加载了 ${allChampionData.length} 个英雄数据，共 ${allTags.size} 种角色类型`);

    } catch (error) {
        console.error("加载英雄数据失败:", error);
        // 显示错误信息
        if (currentActionEl) {
            currentActionEl.textContent = "错误：无法加载英雄数据！";
        }
        // 禁用操作
        modeSelectionDiv.innerHTML = '<p style="color: red;">无法加载必要的英雄数据，请刷新页面重试。</p>';
    }
}

// --- Check URL Parameters ---
function checkSessionParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const session = urlParams.get('session');
    const role = urlParams.get('role');
    
    if (session) {
        // Try to join existing session
        joinSession(session, role);
    }
}

// --- Join Existing Session ---
async function joinSession(session, role) {
    try {
        sessionId = session;
        userRole = role;
        isSessionActive = true;
        
        console.log(`加入会话: ${sessionId} 角色: ${userRole}`);
        
        // 对于全局模式下的游戏，载入系统禁用的英雄
        if (window.location.search.includes('global_session')) {
            const urlParams = new URLSearchParams(window.location.search);
            globalModeSessionId = urlParams.get('global_session');
            
            if (globalModeSessionId) {
                // 先尝试直接从URL获取游戏编号
                const gameParam = urlParams.get('game');
                if (gameParam && !isNaN(parseInt(gameParam))) {
                    currentGameNumber = parseInt(gameParam);
                    console.log(`从URL参数获取到游戏编号: ${currentGameNumber}`);
                } else {
                    // 如果URL没有游戏编号，尝试从会话ID中提取
                    const gameMatch = sessionId.match(/game(\d+)/i);
                    if (gameMatch && gameMatch[1]) {
                        currentGameNumber = parseInt(gameMatch[1]);
                        console.log(`从会话ID提取到游戏编号: ${currentGameNumber}`);
                    } else {
                        // 如果还是没有找到，尝试从全局会话数据中查找
                        console.log("URL和会话ID中都没有找到游戏编号，尝试从全局会话数据查找");
                        try {
                            const response = await fetch(`${API_BASE_URL}?action=getGlobalSession&global_session_id=${globalModeSessionId}`);
                            const responseData = await response.json();
                            
                            if (responseData.status === 'success' && responseData.data) {
                                let gameFound = false;
                                // 遍历会话数据中的所有游戏，查找当前会话ID
                                for (let i = 1; i <= 5; i++) {
                                    const sessionKey = `session_id${i}`;
                                    if (responseData.data[sessionKey] === sessionId) {
                                        currentGameNumber = i;
                                        gameFound = true;
                                        console.log(`从全局会话数据找到游戏编号: ${currentGameNumber}`);
                                        break;
                                    }
                                }
                                
                                if (!gameFound) {
                                    console.warn("从全局会话数据中未找到当前会话ID");
                                }
                            }
                        } catch (e) {
                            console.error("查询全局会话数据时出错:", e);
                        }
                    }
                    
                    // 如果仍然没有找到游戏编号，使用默认值1
                    if (!currentGameNumber || currentGameNumber <= 0) {
                        currentGameNumber = 1;
                        console.log("未能确定游戏编号，使用默认值: 1");
                    }
                }
                
                console.log(`当前游戏编号: ${currentGameNumber}`);
                
                // 先加载前面对局数据
                await loadPreviousGamesData();
                
                // 加载系统禁用英雄
                loadBansFromPreviousGames();
                
                // 创建前面对局信息区域
                createPreviousGamesInfoSection();
            }
        }
        
        // 加载会话数据
        const dataLoaded = await loadSessionData();
        
        // 根据角色设置UI
        setupRoleUI();
        
        // 修复：确保在所有数据加载完成后才调用determineNextAction
        if (dataLoaded) {
            console.log("会话数据加载完成，调用determineNextAction");
            determineNextAction();
        } else {
            console.warn("会话数据加载失败或没有新数据");
            // 如果是新创建的会话，可能需要初始化BP流程
            if (currentMode && currentStep === 0) {
                console.log("初始化新会话的BP流程");
                determineNextAction();
            }
        }
        
        if (currentMode && currentMode !== '') {
            console.log("成功加载现有会话数据");
        } else {
            console.error("无法加载会话数据或会话为空");
        }
        
    } catch (error) {
        console.error("加入会话失败:", error);
        alert(`加入会话失败: ${error.message}`);
        
        // 失败时重置状态并显示模式选择
        resetSessionState();
        initialScreenContainer.classList.remove('hidden'); // 修复：显示整个初始屏幕
    }
}

// --- Load Session Data ---
async function loadSessionData() {
    if (!isSessionActive || !sessionId) return;
    
    try {
        // Fetch session data from API
        // 添加时间戳参数防止浏览器缓存
        const response = await fetch(`${API_BASE_URL}?action=getSession&session_id=${sessionId}&_t=${Date.now()}`);
        const responseData = await response.json();
        
        if (responseData.status === 'error') {
            throw new Error(responseData.message);
        }
        
        const data = responseData.data;
        
        // 避免不必要的更新 - 检查时间戳是否有变化
        if (data.last_updated && new Date(data.last_updated).getTime() <= lastPollTime) {
            return false; // 没有新数据
        }
        
        // 更新最后同步时间
        lastPollTime = new Date(data.last_updated).getTime();
        
        // 保存旧状态，用于比较变化
        const oldState = {
            blueBans: [...blueBans],
            redBans: [...redBans],
            bluePicks: [...bluePicks],
            redPicks: [...redPicks],
            whosTurn: whosTurn,
            actionType: actionType,
            currentStep: currentStep
        };
        
        // Load all state variables
        currentMode = data.current_mode;
        currentPhase = data.current_phase;
        currentStep = parseInt(data.current_step);
        whosTurn = data.whos_turn;
        actionType = data.action_type;
        blueBans = Array.isArray(data.blue_bans) ? data.blue_bans : [];
        redBans = Array.isArray(data.red_bans) ? data.red_bans : [];
        bluePicks = Array.isArray(data.blue_picks) ? data.blue_picks : [];
        redPicks = Array.isArray(data.red_picks) ? data.red_picks : [];
        
        // 检查状态是否有变化
        const hasChanges = 
            !arraysEqual(oldState.blueBans, blueBans) ||
            !arraysEqual(oldState.redBans, redBans) ||
            !arraysEqual(oldState.bluePicks, bluePicks) ||
            !arraysEqual(oldState.redPicks, redPicks) ||
            oldState.whosTurn !== whosTurn ||
            oldState.actionType !== actionType ||
            oldState.currentStep !== currentStep;
        
        // 加载裁判禁用的英雄列表
        try {
            let serverSystemBannedChampions = [];
            
            // 首先尝试直接解析数组
            if (Array.isArray(data.system_banned_champions)) {
                serverSystemBannedChampions = data.system_banned_champions;
            } 
            // 然后尝试解析JSON字符串
            else if (data.system_banned_champions && typeof data.system_banned_champions === 'string') {
                serverSystemBannedChampions = JSON.parse(data.system_banned_champions);
            } 
            // 如果都失败，使用空数组
            else {
                serverSystemBannedChampions = [];
            }
            
            console.log("从服务器加载的系统禁用英雄:", serverSystemBannedChampions);
            
            // 修复：如果是全局模式且当前游戏编号大于1，需要合并前面对局的英雄和服务器的系统禁用英雄
            if (currentMode === 'global' && currentGameNumber > 1) {
                // 保存当前已有的系统禁用英雄（由loadBansFromPreviousGames设置）
                const previousGamesSystemBans = [...systemBannedChampions];
                
                // 合并服务器的系统禁用英雄（可能包含裁判手动禁用的）
                serverSystemBannedChampions.forEach(championId => {
                    if (!previousGamesSystemBans.includes(championId)) {
                        previousGamesSystemBans.push(championId);
                    }
                });
                
                systemBannedChampions = previousGamesSystemBans;
                console.log("合并后的系统禁用英雄:", systemBannedChampions);
            } else {
                // 非全局模式或第一局，直接使用服务器数据
                systemBannedChampions = serverSystemBannedChampions;
            }
        } catch (e) {
            console.error("解析系统禁用英雄列表时出错:", e);
            // 如果解析失败且不是全局模式，设为空数组
            if (currentMode !== 'global' || currentGameNumber <= 1) {
                systemBannedChampions = [];
            }
            // 如果是全局模式且已经由loadBansFromPreviousGames设置过，保持不变
        }
        
        console.log("加载的系统禁用英雄:", systemBannedChampions);
        
        // Recreate sets
        bannedChampions = new Set([
            ...blueBans.filter(id => !id.startsWith('EmptyBan_')), 
            ...redBans.filter(id => !id.startsWith('EmptyBan_')),
            ...systemBannedChampions // 添加系统禁用的英雄
        ]);
        pickedChampions = new Set([...bluePicks, ...redPicks]);
        
        // Enter BP interface
        initialScreenContainer.classList.add('hidden'); // 修复：隐藏整个初始屏幕
        bpInterfaceDiv.classList.remove('hidden');
        
        // Setup UI elements based on mode
        if (currentMode === 'ranked') {
            modeTitleEl.textContent = '排位模式 BP';
            setupSlots(5, 5);
        } else if (currentMode === 'competitive' || currentMode === 'global') {
            // 全局模式也使用竞技征召的BP流程
            modeTitleEl.textContent = currentMode === 'global' ? '全局BP模式' : '竞技征召 BP';
            setupSlots(5, 5);
        }
        
        // Update all UI elements
        updateAllUI();
        
        // 修复：检测BP完成状态，确保所有客户端都能收到提示
        if (currentPhase === 'finished' && currentMode === 'global' && currentGameNumber > 0) {
            // 检查是否已经显示过完成提示
            const hasShownCompletion = sessionStorage.getItem(`game_${currentGameNumber}_completed`);
            if (!hasShownCompletion) {
                // 设置标记，避免重复显示
                sessionStorage.setItem(`game_${currentGameNumber}_completed`, 'true');
                
                // 延迟显示提示，确保UI更新完成
                setTimeout(() => {
                    alert(`Game ${currentGameNumber} BP已完成！`);
                    console.log(`Game ${currentGameNumber} BP完成提示已显示给 ${userRole}`);
                }, 500);
            }
        }
        
        // 修复：检测BP完成状态，确保所有客户端都能收到提示
        if (currentPhase === 'finished' && currentMode === 'global' && currentGameNumber > 0) {
            // 检查是否已经显示过完成提示
            const hasShownCompletion = sessionStorage.getItem(`game_${currentGameNumber}_completed`);
            if (!hasShownCompletion) {
                // 设置标记，避免重复显示
                sessionStorage.setItem(`game_${currentGameNumber}_completed`, 'true');
                
                // 延迟显示提示，确保UI更新完成
                setTimeout(() => {
                    alert(`Game ${currentGameNumber} BP已完成！`);
                    console.log(`Game ${currentGameNumber} BP完成提示已显示给 ${userRole}`);
                }, 500);
            }
        }
        
        // 观战模式额外处理：确保UI正确显示
        if (userRole === 'observer') {
            console.log("观战模式：强制更新UI显示");
            // 如果英雄池为空，强制重新渲染
            const championItems = championPoolDiv.querySelectorAll('.champion-item[data-id]');
            if (championItems.length === 0) {
                renderChampionPool();
            }
        }
        
        // 移除这里的determineNextAction调用，避免重复调用
        // determineNextAction();
        
        return true; // 成功加载新数据
    } catch (error) {
        console.error("加载会话数据失败:", error);
        return false;
    }
}

// 辅助函数：比较两个数组是否相等
function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    
    return true;
}

// --- Setup Role-specific UI ---
function setupRoleUI() {
    // Hide mode selection for non-hosts
    if (userRole !== 'host') {
        modeSelectionDiv.classList.add('hidden');
        
        // 需求1：为红蓝队长修改重置按钮的行为和样式
        const resetButton = document.querySelector('button[onclick="resetUI()"]');
        if (resetButton) {
            if (userRole === 'blue') {
                resetButton.textContent = '你是蓝方队长';
                resetButton.style.backgroundColor = '#1E88E5'; // Blue color
                resetButton.onclick = () => { 
                    console.log("蓝方队长点击了刷新按钮");
                    loadSessionData(); // 重新获取当前阶段信息
                };
            } else if (userRole === 'red') {
                resetButton.textContent = '你是红方队长';
                resetButton.style.backgroundColor = '#E53935'; // Red color
                resetButton.onclick = () => { 
                    console.log("红方队长点击了刷新按钮");
                    loadSessionData(); // 重新获取当前阶段信息
                };
            }
        }
        
        // 裁判权限 - 可以随时禁用英雄
        if (userRole === 'referee') {
            // 创建裁判控制面板
            createRefereePanel();
            
            // 修改英雄池点击行为
            championPoolDiv.classList.add('referee-mode');
        }
        // 观战者没有权限
        else if (userRole === 'observer') {
            // Disable champion selection
            championPoolDiv.classList.add('observer-mode');
            confirmButtonEl.disabled = true;
            emptyBanButtonEl.disabled = true;
            
            // Add observer notice
            const observerNotice = document.createElement('div');
            observerNotice.id = 'observer-notice';
            observerNotice.textContent = '观战模式 - 仅可观看';
            document.querySelector('.top-bar').appendChild(observerNotice);
            
            // 确保观战模式下英雄池正确渲染
            if (allChampionData.length > 0) {
                renderChampionPool();
            }
        }
    }
    
    // Start polling for updates
    startSessionPolling();
    
    // 创建系统禁用英雄区域
    createSystemBannedSection();
    
    // 初始更新系统禁用英雄显示
    updateSystemBannedDisplay();
}

// --- 创建裁判控制面板 ---
function createRefereePanel() {
    // 创建裁判通知
    const refereeNotice = document.createElement('div');
    refereeNotice.id = 'referee-notice';
    refereeNotice.textContent = '裁判模式 - 点击英雄可禁用/解禁';
    document.querySelector('.top-bar').appendChild(refereeNotice);
    
    // 修改英雄池中英雄的点击行为
    // 这部分在renderChampionPool中实现
}

// --- 创建系统禁用英雄区域 ---
function createSystemBannedSection() {
    // 检查是否已存在
    if (document.getElementById('system-banned-section')) {
        return;
    }
    
    // 创建区域
    const systemBannedSection = document.createElement('div');
    systemBannedSection.id = 'system-banned-section';
    systemBannedSection.className = 'system-banned-section';
    
    // 添加标题
    const title = document.createElement('h4');
    title.textContent = '系统禁用英雄';
    systemBannedSection.appendChild(title);
    
    // 创建英雄容器
    const championsContainer = document.createElement('div');
    championsContainer.id = 'system-banned-champions';
    championsContainer.className = 'system-banned-champions';
    systemBannedSection.appendChild(championsContainer);
    
    // 添加到主界面
    bpInterfaceDiv.appendChild(systemBannedSection);
}

// --- 更新系统禁用英雄显示 ---
function updateSystemBannedDisplay() {
    const container = document.getElementById('system-banned-champions');
    if (!container) return;
    
    // 清空现有内容
    container.innerHTML = '';
    
    // 如果没有禁用英雄，显示提示
    if (systemBannedChampions.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = '当前没有系统禁用的英雄';
        container.appendChild(emptyMessage);
        return;
    }
    
    // 添加所有系统禁用的英雄
    systemBannedChampions.forEach(championId => {
        const champion = allChampionData.find(c => c.id === championId);
        if (!champion) return; // 跳过找不到的英雄
        
        const champDiv = document.createElement('div');
        champDiv.className = 'system-banned-item';
        champDiv.dataset.id = championId;
        
        // 添加图片
        const img = document.createElement('img');
        img.src = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${championId}.png`;
        img.alt = champion.name;
        img.title = `${champion.name} (${champion.title})`;
        
        // 图片加载失败的备用显示
        img.onerror = function() {
            champDiv.textContent = championId.substring(0,3);
            champDiv.style.fontSize = '10px';
            champDiv.style.textAlign = 'center';
            champDiv.style.lineHeight = '40px';
        };
        
        champDiv.appendChild(img);
        
        // 移除英雄名称提示
        // const nameSpan = document.createElement('span');
        // nameSpan.className = 'champion-name-tooltip';
        // nameSpan.textContent = champion.name;
        // champDiv.appendChild(nameSpan);
        
        // 裁判可以点击解除禁用
        if (userRole === 'referee') {
            champDiv.classList.add('referee-can-unban');
            champDiv.addEventListener('click', () => toggleSystemBan(championId));
        }
        
        container.appendChild(champDiv);
    });
}

// --- 切换系统禁用状态 ---
async function toggleSystemBan(championId) {
    // 只有裁判可以操作
    if (userRole !== 'referee') {
        console.log("非裁判角色，无法操作系统禁用");
        return;
    }
    
    // 检查是否已经在禁用列表中
    const index = systemBannedChampions.indexOf(championId);
    
    if (index !== -1) {
        // 已禁用，需要解除
        console.log(`解除系统禁用: ${getChampionName(championId)}`);
        systemBannedChampions.splice(index, 1);
        bannedChampions.delete(championId);
        
        // 视觉反馈
        const systemBannedItems = document.querySelectorAll(`.system-banned-item[data-id="${championId}"]`);
        systemBannedItems.forEach(item => {
            item.classList.add('removing');
            setTimeout(() => item.remove(), 300); // 添加淡出动画
        });
    } else {
        // 检查是否已被选择
        if (pickedChampions.has(championId)) {
            alert(`${getChampionName(championId)} 已经被选择，无法系统禁用`);
            return;
        }
        
        // 检查是否已被常规禁用
        if (blueBans.includes(championId) || redBans.includes(championId)) {
            // 常规禁用的可以再次系统禁用，不需要报错
            console.log(`${getChampionName(championId)} 已经被常规禁用，再次添加到系统禁用列表`);
        }
        
        // 添加到系统禁用列表
        console.log(`添加系统禁用: ${getChampionName(championId)}`);
        systemBannedChampions.push(championId);
        bannedChampions.add(championId);
    }
    
    // 更新显示
    updateSystemBannedDisplay();
    
    // 更新英雄池显示
    renderChampionPool();
    
    try {
        // 保存更改到服务器
        const result = await saveSessionData();
        if (result) {
            console.log("系统禁用变更已同步到服务器");
        } else {
            console.error("系统禁用变更同步失败");
            alert("系统禁用操作同步失败，请重试");
        }
    } catch (error) {
        console.error("保存系统禁用变更时出错:", error);
        alert("系统禁用操作同步出错");
    }
}

// 辅助函数：获取英雄名称
function getChampionName(championId) {
    const champion = allChampionData.find(c => c.id === championId);
    return champion ? champion.name : championId;
}

// --- Polling for Updates ---
function startSessionPolling() {
    if (userRole !== 'host') {
        // 使用递归setTimeout代替setInterval，防止请求堆积
        const poll = async () => {
            await loadSessionData();
            setTimeout(poll, 500); // 1秒轮询一次，提高响应速度
        };
        poll();
    }
}

// --- Save Session Data ---
async function saveSessionData() {
    if (!isSessionActive || !sessionId) return;
    
    // 准备数据
    const sessionData = {
        session_id: sessionId,
        global_session_id: globalModeSessionId,
        game_number: currentGameNumber,
        current_mode: currentMode,
        current_phase: currentPhase,
        current_step: currentStep,
        whos_turn: whosTurn,
        action_type: actionType,
        blue_bans: blueBans,
        red_bans: redBans,
        blue_picks: bluePicks,
        red_picks: redPicks,
        system_banned_champions: systemBannedChampions,
        user_role: userRole,
        action: pendingChampionId ? `${actionType}_${pendingChampionId}` : actionType
    };
    
    console.log("正在保存会话数据:", sessionData);
    console.log("系统禁用的英雄:", systemBannedChampions);
    
    try {
        // 发送数据
        const response = await fetch(`${API_BASE_URL}?action=updateSession`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        
        const responseData = await response.json();
        
        if (responseData.status === 'error') {
            throw new Error(responseData.message);
        }

        // 保存成功后再次更新UI，确保本地显示状态是最新的
        updateAllUI();
        
        // 如果是全局模式，且BP阶段已经完成，同时更新全局会话数据
        if (currentMode === 'global' && currentGameNumber > 0 && currentPhase === 'finished') {
            await saveCurrentGameToGlobal();
        }
        
        console.log("会话数据已保存:", responseData);
        return true;
    } catch (error) {
        console.error("保存会话数据错误:", error);
        return false;
    }
}

// --- Update All UI Elements ---
function updateAllUI() {
    try {
        // 性能优化：缓存当前状态，避免不必要的更新
        const currentTitle = modeTitleEl.textContent;
        let newTitle = '';
        
        // 更新标题
        if (currentMode === 'ranked') {
            newTitle = '排位模式 BP';
        } else if (currentMode === 'competitive') {
            newTitle = '竞技征召 BP';
        } else if (currentMode === 'global') {
            // 确保游戏编号至少为1
            if (!currentGameNumber || currentGameNumber <= 0) {
                currentGameNumber = 1;
            }
            newTitle = `全局BP模式 - Game ${currentGameNumber}`;
            
            const gameIndicator = document.getElementById('game-indicator');
            if (gameIndicator) {
                gameIndicator.classList.remove('hidden');
                const currentGameEl = document.getElementById('current-game');
                if (currentGameEl && currentGameEl.textContent !== `Game ${currentGameNumber}`) {
                    currentGameEl.textContent = `Game ${currentGameNumber}`;
                }
            }
        }
        
        // 只在标题确实需要更新时才更新
        if (currentTitle !== newTitle) {
            modeTitleEl.textContent = newTitle;
        }
        
        // 更新各方条状态 - 这些函数内部已经有优化，只更新变化的槽位
        updatePanelSlots('blue-bans', blueBans, 'ban');
        updatePanelSlots('red-bans', redBans, 'ban');
        updatePanelSlots('blue-picks', bluePicks, 'pick');
        updatePanelSlots('red-picks', redPicks, 'pick');
        
        // 修复：更新当前行动指示器
        if (whosTurn && actionType) {
            updateActionIndicator();
        }
        
        // 性能优化：只在必要时更新英雄池状态，而不是完全重新渲染
        updateChampionPoolStates();
        
        // 更新系统禁用英雄显示
        updateSystemBannedDisplay();
        
    } catch (error) {
        console.error("更新UI时出错:", error);
    }
}

// 新增：只更新英雄池中英雄的状态，而不重新渲染整个池子
function updateChampionPoolStates() {
    const championItems = championPoolDiv.querySelectorAll('.champion-item[data-id]');
    
    // 如果英雄池为空或者英雄数量不正确，需要完整重新渲染
    if (championItems.length === 0 || championItems.length !== allChampionData.length) {
        console.log("英雄池需要完整重新渲染");
        renderChampionPool();
        return;
    }
    
    championItems.forEach(item => {
        const championId = item.dataset.id;
        if (championId) {
            updateChampionItemState(item, championId);
        }
    });
    
    // 只有在搜索或过滤条件变化时才完全重新渲染
    // 这个检查可以根据具体需求进一步优化
}

// 更新面板的槽位
function updatePanelSlots(containerId, championsArray, slotType) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`找不到容器: ${containerId}`);
        return;
    }

    const prefix = containerId.replace('s', '-'); // 例如：blue-bans -> blue-ban
    const totalSlots = 5;

    // 性能优化：确保槽位存在，如果不存在则创建，而不是每次都重建
    if (container.childElementCount !== totalSlots) {
        clearSlots(container);
        createSlots(container, totalSlots, prefix);
    }

    // 性能优化：遍历并更新现有槽位，而不是销毁重建
    for (let i = 0; i < totalSlots; i++) {
        const slot = container.children[i];
        if (!slot) continue;

        const championId = championsArray[i];

        // 重置槽位状态
        slot.innerHTML = '';
        slot.className = 'bp-slot'; 
        
        if (championId) {
            // 如果有英雄ID，填充槽位
            if (slotType === 'ban' && championId.startsWith('EmptyBan_')) {
                // 这是一个空禁用
                slot.textContent = '空';
                slot.classList.add('empty-ban');
            } else {
                updateSlotWithChampion(slot, championId);
            }
        } else {
            // 如果没有英雄ID，显示占位符
            const placeholder = prefix.includes('ban') ? 'B' : 'P';
            slot.textContent = `${placeholder}${i + 1}`;
        }
    }
}

// 更新槽位，添加英雄图片
function updateSlotWithChampion(slot, championId) {
    slot.innerHTML = ''; // 清空槽位内容
    
    // 查找英雄完整信息
    const champion = allChampionData.find(c => c.id === championId);
    
    const img = document.createElement('img');
    img.src = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${championId}.png`;
    img.alt = champion ? champion.name : championId;
    
    // 设置提示文本为中文名和称号
    if (champion) {
        img.title = `${champion.name} (${champion.title})`;
        // 为槽位添加数据属性，用于显示或其他目的
        slot.dataset.championName = champion.name;
        slot.dataset.championTitle = champion.title;
    } else {
        img.title = championId;
    }
    
    img.onerror = () => {
        slot.textContent = championId.substring(0,3);
        slot.style.fontSize = '10px';
        slot.style.textAlign = 'center';
        slot.style.lineHeight = '50px';
    };
    slot.appendChild(img);
}

// --- Modified Game Logic ---
async function startGame(mode) {
    // 如果是要启动全局BP模式，调用游戏选择函数
    if (mode === 'global') {
        showGameSelection(mode);
        return;
    }
    
    currentMode = mode;
    currentGameNumber = 0; // 重置游戏编号，因为不是全局模式
    
    // Generate session ID if not existing
    if (!sessionId) {
        sessionId = generateSessionId();
        userRole = 'host';
        isSessionActive = true;
    }
    
    initialScreenContainer.classList.add('hidden'); // 隐藏整个初始屏幕
    bpInterfaceDiv.classList.remove('hidden');
    
    // 隐藏游戏指示器
    gameIndicatorDiv.classList.add('hidden');

    // Reset states
    resetGameStates();
    systemBannedChampions = []; // 确保系统禁用英雄列表被重置为空数组

    // Setup UI elements based on mode
    if (mode === 'competitive') {
        modeTitleEl.textContent = '竞技征召 BP';
        setupSlots(5, 5);
        determineNextAction();
    }
    
    // Generate and display share links
    generateShareLinks();

    renderChampionPool(); // Display available champions
    
    // 初始化系统禁用英雄区域
    createSystemBannedSection();
    updateSystemBannedDisplay();
    
    // 准备会话数据
    const sessionData = {
        session_id: sessionId,
        current_mode: currentMode,
        current_phase: currentPhase,
        current_step: currentStep,
        whos_turn: whosTurn,
        action_type: actionType,
        blue_bans: blueBans,
        red_bans: redBans,
        blue_picks: bluePicks,
        red_picks: redPicks,
        system_banned_champions: systemBannedChampions // 添加系统禁用英雄列表
    };
    
    console.log("创建会话数据:", sessionData);
    
    // Create session in database
    try {
        const response = await fetch(`${API_BASE_URL}?action=createSession`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        
        const responseData = await response.json();
        
        if (responseData.status === 'error') {
            throw new Error(responseData.message);
        }
        
        console.log("会话创建成功:", responseData);
    } catch (error) {
        console.error("创建会话错误:", error);
        alert('创建会话失败: ' + error.message);
    }
}

// --- Generate Session ID ---
function generateSessionId() {
    return Math.random().toString(36).substring(2, 10);
}

// --- Generate Share Links ---
function generateShareLinks() {
    // Create share links container if it doesn't exist
    if (!document.getElementById('share-links')) {
        const linksDiv = document.createElement('div');
        linksDiv.id = 'share-links';
        linksDiv.className = 'share-links-container';
        bpInterfaceDiv.insertBefore(linksDiv, bpInterfaceDiv.firstChild);
    }
    
    const shareLinksDivEl = document.getElementById('share-links');
    
    // Clear previous content
    shareLinksDivEl.innerHTML = '<h3>分享链接</h3>';
    
    // Base URL including path but excluding query parameters
    const baseUrl = window.location.href.split('?')[0];
    
    // Create links
    const blueLink = `${baseUrl}?session=${sessionId}&role=blue`;
    const redLink = `${baseUrl}?session=${sessionId}&role=red`;
    const observerLink = `${baseUrl}?session=${sessionId}&role=observer`;
    const refereeLink = `${baseUrl}?session=${sessionId}&role=referee`; // 添加裁判链接
    
    // Create link elements with copy buttons
    const blueLinkEl = createLinkElement('蓝方队长链接', blueLink);
    const redLinkEl = createLinkElement('红方队长链接', redLink);
    const refereeLinkEl = createLinkElement('裁判链接', refereeLink); // 裁判链接
    const observerLinkEl = createLinkElement('观战链接', observerLink);
    
    // Add links to container
    shareLinksDivEl.appendChild(blueLinkEl);
    shareLinksDivEl.appendChild(redLinkEl);
    shareLinksDivEl.appendChild(refereeLinkEl); // 添加到容器
    shareLinksDivEl.appendChild(observerLinkEl);
}

// Helper function to create a link element with copy button
function createLinkElement(label, url) {
    const container = document.createElement('div');
    container.className = 'share-link';
    
    const labelEl = document.createElement('strong');
    labelEl.textContent = label + ': ';
    
    const linkInput = document.createElement('input');
    linkInput.type = 'text';
    linkInput.value = url;
    linkInput.readOnly = true;
    
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '复制';
    copyBtn.onclick = () => {
        linkInput.select();
        document.execCommand('copy');
        copyBtn.textContent = '已复制!';
        setTimeout(() => {
            copyBtn.textContent = '复制';
        }, 2000);
    };
    
    container.appendChild(labelEl);
    container.appendChild(linkInput);
    container.appendChild(copyBtn);
    
    return container;
}

// Modified function to determine if current user can make a move
function canUserMakeMove() {
    if (userRole === 'host') return true;
    if (userRole === 'referee') return true; // 裁判永远可以操作
    if (userRole === 'observer') return false;
    return (userRole === 'blue' && whosTurn === 'blue') || (userRole === 'red' && whosTurn === 'red');
}

// --- Function to Confirm Selection ---
async function confirmSelection() {
    if (!pendingChampionId) {
        console.warn("No champion pending selection.");
        return;
    }
    if (!whosTurn || !actionType) {
        console.warn("Cannot confirm: No action defined.");
        return;
    }
    
    // Check if user has permission
    if (!canUserMakeMove()) {
        alert("现在不是你的回合！");
        return;
    }

    console.log(`${whosTurn} ${actionType}s ${pendingChampionId} (Confirmed)`);

    const confirmedChampionId = pendingChampionId;

    // Update state arrays (Ban/Pick)
    if (actionType === 'ban') {
        if (whosTurn === 'blue') {
            blueBans.push(confirmedChampionId);
        } else {
            redBans.push(confirmedChampionId);
        }
        bannedChampions.add(confirmedChampionId);
    } else { // actionType === 'pick'
        if (whosTurn === 'blue') {
            bluePicks.push(confirmedChampionId);
        } else {
            redPicks.push(confirmedChampionId);
        }
        pickedChampions.add(confirmedChampionId);
    }

    // 立即更新UI - 直接调用updateAllUI而不是单独更新
    updateAllUI();

    // Reset pending state
    const oldPendingItem = championPoolDiv.querySelector(`.champion-item[data-id="${pendingChampionId}"]`);
    if(oldPendingItem) oldPendingItem.classList.remove('pending');
    
    pendingChampionId = null;
    updatePendingChampionUI();
    confirmButtonEl.disabled = true;

    // Move to next step
    currentStep++;
    determineNextAction();
    
    // Save session data after change
    if (isSessionActive) {
        await saveSessionData();
    }
}

function handleChampionSelect(championId) {
    if (bannedChampions.has(championId) || pickedChampions.has(championId)) {
        console.warn("Champion already selected/banned:", championId);
        return; // Ignore click if already banned or picked
    }
    if (!whosTurn || !actionType) {
        console.warn("No action defined yet.");
        return;
    }
    
    // Check if user has permission
    if (!canUserMakeMove()) {
        return; // Silently ignore clicks from observers and wrong team
    }

    // Clear previous pending state in the pool
    if (pendingChampionId) {
        updateChampionPoolItemState(pendingChampionId, 'clearPending');
    }

    // Set new pending champion
    pendingChampionId = championId;
    console.log("Pending selection:", pendingChampionId);

    // Update pending UI display
    updatePendingChampionUI();

    // Add pending class to the selected item in the pool
    updateChampionPoolItemState(championId, 'pending');

    // Enable the confirm button
    confirmButtonEl.disabled = false;
}

function resetGameStates() {
    // 修复：对于新游戏，应该重置currentStep为0
    // 只有在非全局模式下，或者是全局模式的第一次初始化时才重置currentStep
    if (currentMode !== 'global' || currentGameNumber === 0) {
        currentStep = 0;
        console.log("重置currentStep为0");
    }
    
    blueBans = [];
    redBans = [];
    bluePicks = [];
    redPicks = [];
    
    // 对于全局模式，系统禁用英雄列表会由loadBansFromPreviousGames设置
    // 所以这里不应该清空它
    // 只有在非全局模式时才清空系统禁用英雄列表
    if (currentMode !== 'global') {
        systemBannedChampions = []; 
    }
    
    // 重置基础状态变量
    currentPhase = '';
    whosTurn = '';
    actionType = '';
    
    bannedChampions.clear();
    pickedChampions.clear();
    stopTimer(); // Stop any previous timer
    
    // Reset pending state
    pendingChampionId = null;
    updatePendingChampionUI();
    confirmButtonEl.disabled = true;
}

// 恢复重置UI的函数
function resetUI() {
    stopTimer();
    initialScreenContainer.classList.remove('hidden'); // 显示初始屏幕
    bpInterfaceDiv.classList.add('hidden');
    gameSelectionDiv.classList.add('hidden');
    gameIndicatorDiv.classList.add('hidden');
    
    // 移除前面对局信息区域
    const prevGamesInfo = document.getElementById('previous-games-info');
    if (prevGamesInfo) {
        prevGamesInfo.remove();
    }
    
    currentMode = null;
    currentPhase = '';
    currentStep = 0;
    whosTurn = '';
    actionType = '';
    blueBans = [];
    redBans = [];
    bluePicks = [];
    redPicks = [];
    systemBannedChampions = []; // 重置系统禁用英雄列表
    bannedChampions.clear();
    pickedChampions.clear();
    searchBox.value = ''; // Clear search box
    
    // 重置全局模式数据
    currentGameNumber = 0;
    
    // 性能优化：清理所有缓存数据
    clearGameDataCache();
    
    // 重置标签过滤器
    activeTagFilter = null;
    if (document.getElementById('tag-filters')) {
        updateTagFilterButtons();
    }
    
    // Reset pending state
    pendingChampionId = null;
    updatePendingChampionUI();
    confirmButtonEl.disabled = true;
    
    // Clear displayed slots
    clearSlots(blueBansDiv);
    clearSlots(redBansDiv);
    clearSlots(bluePicksDiv);
    clearSlots(redPicksDiv);
    
    // 清空系统禁用英雄区域
    const systemBannedContainer = document.getElementById('system-banned-champions');
    if (systemBannedContainer) {
        systemBannedContainer.innerHTML = '<div class="empty-message">当前没有系统禁用的英雄</div>';
    }
    
    // Reset champion pool appearance
    renderChampionPool();
    
    // Hide share links if they exist
    if (document.getElementById('share-links')) {
        document.getElementById('share-links').innerHTML = '';
    }
    
    // Clear session variables
    sessionId = null;
    userRole = 'host';
    isSessionActive = false;
}

function clearSlots(container) {
    container.innerHTML = ''; // Remove previous slots
}

function createSlots(container, count, prefix) {
    for (let i = 0; i < count; i++) {
        const slot = document.createElement('div');
        slot.classList.add('bp-slot');
        slot.id = `${prefix}-${i}`;
        slot.textContent = prefix.includes('ban') ? `B${i + 1}` : `P${i + 1}`; // Placeholder text
        container.appendChild(slot);
    }
}

// 全局变量，当前选中的标签过滤器
let activeTagFilter = null;

// 创建标签过滤按钮
function createTagFilterButtons(tags) {
    // 定义标签的中文名称映射
    const tagNameMap = {
        'Fighter': '战士',
        'Tank': '坦克',
        'Mage': '法师',
        'Assassin': '刺客',
        'Marksman': '射手',
        'Support': '辅助'
    };
    
    // 获取搜索框旁边的容器，或者创建一个新的
    let tagFilterContainer = document.getElementById('tag-filters');
    if (!tagFilterContainer) {
        tagFilterContainer = document.createElement('div');
        tagFilterContainer.id = 'tag-filters';
        tagFilterContainer.className = 'tag-filter-container';
        
        // 将标签过滤器容器插入到搜索框后面
        const searchContainer = document.querySelector('.champion-pool-container');
        searchContainer.insertBefore(tagFilterContainer, document.getElementById('champion-pool'));
    } else {
        // 清空现有的按钮
        tagFilterContainer.innerHTML = '';
    }
    
    // 创建"全部"按钮
    const allButton = document.createElement('button');
    allButton.textContent = '全部';
    allButton.className = 'tag-filter-button active';
    allButton.onclick = () => {
        setActiveTagFilter(null);
        updateTagFilterButtons();
        renderChampionPool();
    };
    tagFilterContainer.appendChild(allButton);
    
    // 按字母顺序对标签排序
    tags.sort();
    
    // 为每个标签创建按钮
    tags.forEach(tag => {
        const button = document.createElement('button');
        // 使用中文名称（如果有的话），否则使用英文名称
        button.textContent = tagNameMap[tag] || tag;
        button.className = 'tag-filter-button';
        button.dataset.tag = tag;
        button.onclick = () => {
            setActiveTagFilter(tag);
            updateTagFilterButtons();
            renderChampionPool();
        };
        tagFilterContainer.appendChild(button);
    });
}

// 设置当前激活的标签过滤器
function setActiveTagFilter(tag) {
    activeTagFilter = tag;
}

// 更新标签按钮的激活状态
function updateTagFilterButtons() {
    const buttons = document.querySelectorAll('.tag-filter-button');
    buttons.forEach(button => {
        if ((button.dataset.tag === activeTagFilter) || 
            (activeTagFilter === null && button.textContent === '全部')) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// 修改搜索英雄的函数，增强搜索体验
function filterChampions() {
    renderChampionPool(); // 根据搜索词重新渲染英雄池
}

function renderChampionPool() {
    const searchTerm = searchBox.value.toLowerCase().trim();
    let champCount = 0;
    
    // 获取当前的英雄项，避免完全重建DOM
    const existingItems = new Map();
    const currentItems = championPoolDiv.querySelectorAll('.champion-item[data-id]');
    currentItems.forEach(item => {
        existingItems.set(item.dataset.id, item);
    });

    // 需要显示的英雄列表
    const championsToShow = [];
    
    // 使用扩展的搜索逻辑
    allChampionData.forEach(champ => {
        // 检查是否符合搜索词条件
        const matchesSearch = searchTerm === '' || champ.searchTerms.includes(searchTerm);
        
        // 检查是否符合标签过滤条件
        const matchesTag = activeTagFilter === null || champ.tags.includes(activeTagFilter);
        
        // 同时满足搜索和标签条件
        if (matchesSearch && matchesTag) {
            championsToShow.push(champ);
            champCount++;
        }
    });

    // 如果没有匹配结果，显示提示
    if (champCount === 0) {
        championPoolDiv.innerHTML = ''; // 清空现有英雄池
        const noResultsMsg = document.createElement('div');
        noResultsMsg.className = 'no-results-message';
        
        if (activeTagFilter && searchTerm) {
            noResultsMsg.textContent = `没有找到匹配的"${searchTerm}"且为${getTagChineseName(activeTagFilter)}类型的英雄`;
        } else if (activeTagFilter) {
            noResultsMsg.textContent = `没有找到${getTagChineseName(activeTagFilter)}类型的英雄`;
        } else if (searchTerm) {
            noResultsMsg.textContent = `没有找到匹配的"${searchTerm}"英雄`;
        } else {
            noResultsMsg.textContent = '没有可用的英雄';
        }
        
        championPoolDiv.appendChild(noResultsMsg);
        return;
    }

    // 性能优化：只更新需要更新的英雄项
    const newItemsContainer = document.createDocumentFragment();
    const itemsToUpdate = [];

    championsToShow.forEach(champ => {
        const existingItem = existingItems.get(champ.id);
        
        if (existingItem) {
            // 性能优化：直接更新状态，不再检查返回值或使用无效的 shouldUpdate 变量
            updateChampionItemState(existingItem, champ.id);
            
            // 从已存在的项中移除，剩下的就是需要删除的
            existingItems.delete(champ.id);
            
            // 将现有项添加到新容器
            newItemsContainer.appendChild(existingItem);
        } else {
            // 创建新的英雄项
            const champDiv = createChampionItem(champ);
            newItemsContainer.appendChild(champDiv);
        }
    });

    // 批量更新DOM - 只在真正需要时才清空重建
    if (existingItems.size > 0 || championPoolDiv.children.length !== champCount) {
        championPoolDiv.innerHTML = '';
        championPoolDiv.appendChild(newItemsContainer);
    }
}

// 创建英雄项的辅助函数
function createChampionItem(champ) {
    const champDiv = document.createElement('div');
    champDiv.classList.add('champion-item');
    champDiv.dataset.id = champ.id;
    champDiv.dataset.name = champ.name;

    // 创建英雄图片
    const img = document.createElement('img');
    img.src = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${champ.id}.png`;
    img.alt = champ.name;
    img.title = `${champ.name} (${champ.title})`;
    img.onerror = function() {
        champDiv.textContent = champ.id.substring(0,3);
        champDiv.style.fontSize = '10px';
        champDiv.style.textAlign = 'center';
        champDiv.style.lineHeight = '60px';
    };

    champDiv.appendChild(img);

    // 设置状态和事件
    updateChampionItemState(champDiv, champ.id);
    
    return champDiv;
}

// 性能优化：重构 updateChampionItemState，移除昂贵的DOM操作和事件处理
function updateChampionItemState(champDiv, championId) {
    // 此函数现在只负责视觉状态（CSS类）。
    // 事件处理通过父容器上的事件委托完成。

    // 清除所有可能的状态类，以便重新应用正确的状态
    champDiv.classList.remove('system-banned', 'banned', 'picked', 'pending', 'referee-can-ban');

    // 移除或管理系统禁用图标
    const systemBanIcon = champDiv.querySelector('.system-ban-icon');

    // 按优先级应用状态
    if (systemBannedChampions.includes(championId)) {
        champDiv.classList.add('system-banned');
        if (!systemBanIcon) {
            const banIcon = document.createElement('div');
            banIcon.className = 'system-ban-icon';
            banIcon.innerHTML = '<i class="fas fa-ban"></i>';
            champDiv.appendChild(banIcon);
        }
    } else {
        if (systemBanIcon) systemBanIcon.remove(); // 确保非系统禁用时图标被移除

        if (bannedChampions.has(championId)) {
            champDiv.classList.add('banned');
        } else if (pickedChampions.has(championId)) {
            champDiv.classList.add('picked');
        } else if (championId === pendingChampionId) {
            champDiv.classList.add('pending');
        } else {
            // 如果是裁判模式且英雄可用，显示可禁用状态
            if (userRole === 'referee') {
                champDiv.classList.add('referee-can-ban');
            }
        }
    }
}

function updateSlotUI(championId) {
    let targetSlotId = '';
    // Calculate the correct index within the team's bans/picks
    if (actionType === 'ban') {
        targetSlotId = `${whosTurn}-ban-${(whosTurn === 'blue' ? blueBans.length : redBans.length) - 1}`;
    } else {
        targetSlotId = `${whosTurn}-pick-${(whosTurn === 'blue' ? bluePicks.length : redPicks.length) - 1}`;
    }

    const slotElement = document.getElementById(targetSlotId);
    if (slotElement) {
        slotElement.innerHTML = ''; // Clear placeholder text/previous content
        const img = document.createElement('img');
        // Use the fetched latestVersion here too
        img.src = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${championId}.png`;
        img.alt = championId;
        img.title = championId; // Tooltip
         img.onerror = function() { // Fallback
             slotElement.textContent = championId.substring(0,3);
             slotElement.style.fontSize = '10px';
             slotElement.style.textAlign = 'center';
             slotElement.style.lineHeight = '50px';
         };
        slotElement.appendChild(img);
    } else {
        console.error("Could not find slot:", targetSlotId);
    }
}

function determineNextAction() {
    stopTimer(); // Stop previous timer before starting next step
    
    console.log(`determineNextAction调用 - 当前模式: ${currentMode}, 当前步骤: ${currentStep}, 游戏编号: ${currentGameNumber}`);

    if (currentMode === 'ranked') {
        handleRankedSteps();
    } else if (currentMode === 'competitive' || currentMode === 'global') {
        // 全局模式也使用竞技征召的BP流程
        handleCompetitiveSteps();
    }
    
    console.log(`BP流程判断结果 - 轮到: ${whosTurn}, 动作: ${actionType}, 阶段: ${currentPhase}`);

    // Update the indicator text and start the timer for the new action
    if (whosTurn && actionType) {
         updateActionIndicator();
         startTimer();
         // Ensure confirm button is disabled at the start of a new turn
         confirmButtonEl.disabled = true;
         // Reset pending state visually as well, just in case
         if (pendingChampionId) {
             // 性能优化：此处的 pending 状态将由后续的 updateAllUI 自动处理，无需手动清除
         }
         pendingChampionId = null;
         updatePendingChampionUI();
    } else {
        // BP Finished
        currentActionEl.textContent = "BP 完成!";
        currentActionEl.className = ''; // Remove turn styles
        stopTimer();
        timerValueEl.textContent = '0';
        
        // 如果是全局模式且BP已完成，保存session_id到全局会话
        if (currentMode === 'global' && currentGameNumber > 0) {
            currentPhase = 'finished'; // 设置完成状态
            
            // 先设置完成标记，避免在数据同步时重复显示提示
            sessionStorage.setItem(`game_${currentGameNumber}_completed`, 'true');
            
            saveSessionData().then((success) => {
                if (success) {
                    console.log("BP完成，会话数据已保存");
                    
                    // 明确调用saveCurrentGameToGlobal保存session_id
                    saveCurrentGameToGlobal().then((result) => {
                        if (result) {
                            console.log("BP完成，session_id已保存到全局会话");
                            alert(`Game ${currentGameNumber} BP已完成！session ID: ${sessionId}`);
                        }
                    });
                } else {
                    // 如果保存失败，也显示基本的完成提示
                    alert(`Game ${currentGameNumber} BP已完成！`);
                }
            });
        }
    }
    
    // Update all UI elements
    updateAllUI();
    
    // 修复：如果是全局模式且游戏编号大于1，在数据加载完成后重新加载系统禁用英雄
    if (currentMode === 'global' && currentGameNumber > 1) {
        console.log("重新加载系统禁用英雄以确保本地状态正确");
        loadBansFromPreviousGames();
    }
    
    // 修复：检测BP完成状态，确保所有客户端都能收到提示
    if (currentPhase === 'finished' && currentMode === 'global' && currentGameNumber > 0) {
        // 检查是否已经显示过完成提示
        const hasShownCompletion = sessionStorage.getItem(`game_${currentGameNumber}_completed`);
        if (!hasShownCompletion) {
            // 设置标记，避免重复显示
            sessionStorage.setItem(`game_${currentGameNumber}_completed`, 'true');
            
            // 延迟显示提示，确保UI更新完成
            setTimeout(() => {
                alert(`Game ${currentGameNumber} BP已完成！`);
                console.log(`Game ${currentGameNumber} BP完成提示已显示给 ${userRole}`);
            }, 500);
        }
    }
    
    // 修复：检测BP完成状态，确保所有客户端都能收到提示
    if (currentPhase === 'finished' && currentMode === 'global' && currentGameNumber > 0) {
        // 检查是否已经显示过完成提示
        const hasShownCompletion = sessionStorage.getItem(`game_${currentGameNumber}_completed`);
        if (!hasShownCompletion) {
            // 设置标记，避免重复显示
            sessionStorage.setItem(`game_${currentGameNumber}_completed`, 'true');
            
            // 延迟显示提示，确保UI更新完成
            setTimeout(() => {
                alert(`Game ${currentGameNumber} BP已完成！`);
                console.log(`Game ${currentGameNumber} BP完成提示已显示给 ${userRole}`);
            }, 500);
        }
    }
    
    // 观战模式额外处理：确保UI正确显示
    if (userRole === 'observer') {
        console.log("观战模式：强制更新UI显示");
        // 如果英雄池为空，强制重新渲染
        const championItems = championPoolDiv.querySelectorAll('.champion-item[data-id]');
        if (championItems.length === 0) {
            renderChampionPool();
        }
    }
}

// --- BP Step Logic ---

function handleRankedSteps() {
    // Simplified Ranked Order: B Ban 0-4, R Ban 0-4, BPick 0, RPick 0-1, BPick 1-2, RPick 2, BPick 3, RPick 3-4, BPick 4
    const step = currentStep;
    if (step < 5) { // Blue Bans
        whosTurn = 'blue'; actionType = 'ban'; currentPhase = 'ban';
    } else if (step < 10) { // Red Bans
        whosTurn = 'red'; actionType = 'ban'; currentPhase = 'ban';
    } else if (step === 10) { // B Pick 1 (index 0)
        whosTurn = 'blue'; actionType = 'pick'; currentPhase = 'pick';
    } else if (step === 11 || step === 12) { // R Pick 1 & 2 (index 0, 1)
        whosTurn = 'red'; actionType = 'pick'; currentPhase = 'pick';
    } else if (step === 13 || step === 14) { // B Pick 2 & 3 (index 1, 2)
        whosTurn = 'blue'; actionType = 'pick'; currentPhase = 'pick';
    } else if (step === 15 || step === 16) { // R Pick 3 & 4 (index 2, 3)
        whosTurn = 'red'; actionType = 'pick'; currentPhase = 'pick';
    } else if (step === 17 || step === 18) { // B Pick 4 & 5 (index 3, 4)
        whosTurn = 'blue'; actionType = 'pick'; currentPhase = 'pick';
    } else if (step === 19) { // R Pick 5 (index 4)
        whosTurn = 'red'; actionType = 'pick'; currentPhase = 'pick';
    } else { // Finished
        whosTurn = ''; actionType = ''; currentPhase = 'finished';
    }
}

function handleCompetitiveSteps() {
    // Competitive BP Order: B1-R1-B2-R2-B3-R3 | B1-R1-R2-B2-B3-R3 | R4-B4-R5-B5 | R4-B4-B5-R5
    const step = currentStep;
    console.log(`handleCompetitiveSteps - 当前步骤: ${step}`);
    
    // Ban Phase 1 (Steps 0-5)
    if (step < 6) {
        whosTurn = (step % 2 === 0) ? 'blue' : 'red';
        actionType = 'ban';
        currentPhase = 'ban1';
        console.log(`Ban Phase 1 - 步骤${step}: ${whosTurn} ${actionType}`);
    }
    // Pick Phase 1 (Steps 6-11)
    else if (step < 12) {
        currentPhase = 'pick1';
        actionType = 'pick';
        switch (step) {
            case 6: whosTurn = 'blue'; break; // B Pick 1
            case 7: whosTurn = 'red'; break;  // R Pick 1
            case 8: whosTurn = 'red'; break;  // R Pick 2
            case 9: whosTurn = 'blue'; break; // B Pick 2
            case 10: whosTurn = 'blue'; break; // B Pick 3
            case 11: whosTurn = 'red'; break;  // R Pick 3
        }
        console.log(`Pick Phase 1 - 步骤${step}: ${whosTurn} ${actionType}`);
    }
    // Ban Phase 2 (Steps 12-15)
    else if (step < 16) {
         currentPhase = 'ban2';
         actionType = 'ban';
         whosTurn = (step % 2 === 0) ? 'red' : 'blue'; // Starts with Red Ban
         console.log(`Ban Phase 2 - 步骤${step}: ${whosTurn} ${actionType}`);
    }
    // Pick Phase 2 (Steps 16-19)
    else if (step < 20) {
         currentPhase = 'pick2';
         actionType = 'pick';
         switch (step) {
             case 16: whosTurn = 'red'; break;  // R Pick 4
             case 17: whosTurn = 'blue'; break; // B Pick 4
             case 18: whosTurn = 'blue'; break; // B Pick 5
             case 19: whosTurn = 'red'; break;  // R Pick 5
         }
         console.log(`Pick Phase 2 - 步骤${step}: ${whosTurn} ${actionType}`);
    }
    // Finished
    else {
        whosTurn = ''; actionType = ''; currentPhase = 'finished';
        console.log(`BP完成 - 步骤${step}`);
    }
}

// --- UI Update Functions ---
function updateActionIndicator() {
    console.log(`updateActionIndicator调用 - whosTurn: ${whosTurn}, actionType: ${actionType}`);
    
    if (!whosTurn || !actionType) {
        console.warn("updateActionIndicator: whosTurn或actionType为空");
        return;
    }
    
    if (!currentActionEl) {
        console.error("updateActionIndicator: currentActionEl元素未找到");
        return;
    }
    
    let sideText = whosTurn === 'blue' ? '蓝方' : '红方';
    let actionText = actionType === 'ban' ? '禁用' : '选用';
    
    // Calculate position number
    let positionNumber = 0;
    if (actionType === 'ban') {
        positionNumber = whosTurn === 'blue' ? blueBans.length + 1 : redBans.length + 1;
    } else {
        positionNumber = whosTurn === 'blue' ? bluePicks.length + 1 : redPicks.length + 1;
    }
    
    // Format: 轮到：蓝方 禁用 B1
    const stepIndicator = actionType === 'ban' ? `B${positionNumber}` : `P${positionNumber}`;
    const displayText = `轮到：${sideText} ${actionText}<br>${stepIndicator}`;
    
    console.log(`updateActionIndicator: 设置显示文本: ${displayText.replace('<br>', ' ')}`);
    currentActionEl.innerHTML = displayText;
    
    // Add class for color styling
    const newClassName = whosTurn === 'blue' ? 'blue-turn' : 'red-turn';
    currentActionEl.className = newClassName;
    console.log(`updateActionIndicator: 设置CSS类: ${newClassName}`);
    
    // Show or hide empty ban button based on action type
    if (actionType === 'ban' && canUserMakeMove()) {
        emptyBanButtonEl.classList.remove('hidden');
    } else {
        emptyBanButtonEl.classList.add('hidden');
    }
}

// --- Timer Functions ---
function startTimer() {
    clearInterval(timerInterval); // Clear any existing timer
    timerValue = 30; // Reset timer
    timerValueEl.textContent = timerValue;
    timerInterval = setInterval(() => {
        timerValue--;
        timerValueEl.textContent = timerValue;
        if (timerValue <= 0) {
            stopTimer();
            console.log("Time's up!");
            // Optional: Implement auto-skip or random pick/ban here
            // For simplicity, we just stop the timer. User needs to click.
        }
    }, 1000); // Update every second
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// New function to update the pending champion display area
function updatePendingChampionUI() {
    if (pendingChampionId) {
        const champ = allChampionData.find(c => c.id === pendingChampionId);
        pendingChampionEl.innerHTML = ''; // Clear previous
        const img = document.createElement('img');
        img.src = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${pendingChampionId}.png`;
        img.alt = champ ? champ.name : pendingChampionId;
        img.title = champ ? `${champ.name} (${champ.title})` : pendingChampionId;
        img.onerror = function() { pendingChampionEl.textContent = pendingChampionId.substring(0,3); };
        pendingChampionEl.appendChild(img);
        
        if (champ) {
            // 显示中文名称和称号
            pendingChampionEl.appendChild(document.createTextNode(` ${champ.name} (${champ.title})`));
        } else {
            pendingChampionEl.appendChild(document.createTextNode(` ${pendingChampionId}`));
        }
    } else {
        pendingChampionEl.textContent = '无'; // Reset to default text
    }
}

function setupSlots(banCount, pickCount) {
    clearSlots(blueBansDiv);
    clearSlots(redBansDiv);
    clearSlots(bluePicksDiv);
    clearSlots(redPicksDiv);
    createSlots(blueBansDiv, banCount, 'blue-ban');
    createSlots(redBansDiv, banCount, 'red-ban');
    createSlots(bluePicksDiv, pickCount, 'blue-pick');
    createSlots(redPicksDiv, pickCount, 'red-pick');
}

// --- New Function for Empty Ban ---
async function emptyBanSelection() {
    if (actionType !== 'ban') {
        console.warn("Empty ban only allowed during ban phase");
        return;
    }
    
    // Check if user has permission
    if (!canUserMakeMove()) {
        alert("现在不是你的回合！");
        return;
    }
    
    console.log(`${whosTurn} performs empty ban`);
    
    // Create a special "empty" ban marker
    const emptyBanId = `EmptyBan_${Date.now()}`; // Create unique ID for this empty ban
    
    // Update state arrays (Ban/Pick)
    if (whosTurn === 'blue') {
        blueBans.push(emptyBanId);
    } else {
        redBans.push(emptyBanId);
    }
    
    // Update UI for the slot
    updateSlotWithEmptyBan();
    
    // Reset pending state if any
    pendingChampionId = null;
    updatePendingChampionUI();
    confirmButtonEl.disabled = true;
    
    // Move to next step
    currentStep++;
    determineNextAction();
    
    // Save session data after change
    if (isSessionActive) {
        await saveSessionData();
    }
}

// Helper function to update slot with empty ban marker
function updateSlotWithEmptyBan() {
    let targetSlotId = '';
    if (whosTurn === 'blue') {
        targetSlotId = `blue-ban-${blueBans.length - 1}`;
    } else {
        targetSlotId = `red-ban-${redBans.length - 1}`;
    }
    
    console.log(`尝试查找空ban槽位: ${targetSlotId}`);
    
    const slotElement = document.getElementById(targetSlotId);
    if (slotElement) {
        slotElement.innerHTML = '';
        slotElement.textContent = '空';
        slotElement.classList.add('empty-ban');
        console.log(`成功更新空ban槽位: ${targetSlotId}`);
    } else {
        console.error("Could not find slot:", targetSlotId);
        
        // 调试：列出所有现有的槽位ID
        const allSlots = document.querySelectorAll('.bp-slot[id]');
        console.log("当前所有槽位ID:", Array.from(allSlots).map(slot => slot.id));
        
        // 尝试通过updateAllUI重新渲染来解决
        console.log("尝试通过重新渲染来解决槽位问题");
        updateAllUI();
    }
}

// --- Game Selection Functions ---
function showGameSelection(mode) {
    if (mode === 'global') {
        // 隐藏初始屏幕，显示游戏选择
        initialScreenContainer.classList.add('hidden');
        gameSelectionDiv.classList.remove('hidden');
        
        // 初始化全局模式
        initializeGlobalMode();
    }
}

// 初始化全局BP模式
async function initializeGlobalMode() {
    // 生成全局会话ID（如果还没有）
    if (!globalModeSessionId) {
        globalModeSessionId = generateSessionId() + '_global';
        console.log("创建新的全局会话ID:", globalModeSessionId);
        
        // 创建全局会话记录
        try {
            const response = await fetch(`${API_BASE_URL}?action=createGlobalSession`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    global_session_id: globalModeSessionId
                })
            });
            
            const responseData = await response.json();
            if (responseData.status === 'error') {
                throw new Error(responseData.message);
            }
            
            console.log("全局会话记录创建成功:", responseData);
            
            // 预先创建5个游戏会话
            await createAllGameSessions();
        } catch (error) {
            console.error("创建全局会话记录失败:", error);
            alert('创建全局会话记录失败: ' + error.message);
            return; // 如果创建失败，停止初始化过程
        }
    } else {
        // 如果已有全局会话ID，检查并确保所有游戏会话都已创建
        try {
            const response = await fetch(`${API_BASE_URL}?action=getGlobalSession&global_session_id=${globalModeSessionId}`);
            const responseData = await response.json();
            
            if (responseData.status === 'success' && responseData.data) {
                // 检查是否所有游戏会话ID都存在
                let missingGameSessions = false;
                for (let i = 1; i <= 5; i++) {
                    const sessionKey = `session_id${i}`;
                    if (!responseData.data[sessionKey]) {
                        console.log(`未找到Game ${i}的会话ID，将创建新的会话`);
                        missingGameSessions = true;
                        // 为缺失的游戏创建会话
                        const newSessionId = generateSessionId();
                        await createGameSession(i, newSessionId);
                        await updateGameSessionId(i, newSessionId);
                    }
                }
                
                if (missingGameSessions) {
                    console.log("已补充创建缺失的游戏会话");
                }
            } else {
                // 如果获取全局会话失败，重新创建所有游戏会话
                await createAllGameSessions();
            }
        } catch (error) {
            console.error("检查游戏会话时出错:", error);
            // 如果出错，尝试重新创建所有游戏会话
            await createAllGameSessions();
        }
    }
    
    // 初始化前面对局数据
    previousGamesPicks = {};
    
    // 加载已有的全局会话数据
    await loadPreviousGamesData();
    
    // 创建全局会话信息显示
    createGlobalSessionDisplay();
    
    // 更新游戏选择按钮状态
    updateGameSelectionButtons();
}

// 创建单个游戏会话
async function createGameSession(gameNumber, sessionId) {
    try {
        // 计算这个游戏应该包含的系统禁用英雄（前面对局的选择）
        let gameSystemBannedChampions = [];
        
        if (gameNumber > 1 && previousGamesPicks) {
            console.log(`为Game ${gameNumber}计算系统禁用英雄，基于前面对局数据:`, previousGamesPicks);
            
            // 遍历前面所有对局的选择
            for (let i = 1; i < gameNumber; i++) {
                const gamePicks = previousGamesPicks[i];
                if (gamePicks) {
                    // 添加蓝队选择的英雄
                    if (Array.isArray(gamePicks.blue)) {
                        gamePicks.blue.forEach(championId => {
                            if (championId && !championId.startsWith('EmptyBan_') && !gameSystemBannedChampions.includes(championId)) {
                                gameSystemBannedChampions.push(championId);
                                console.log(`添加Game ${i}蓝队英雄到Game ${gameNumber}系统禁用: ${championId}`);
                            }
                        });
                    }
                    
                    // 添加红队选择的英雄
                    if (Array.isArray(gamePicks.red)) {
                        gamePicks.red.forEach(championId => {
                            if (championId && !championId.startsWith('EmptyBan_') && !gameSystemBannedChampions.includes(championId)) {
                                gameSystemBannedChampions.push(championId);
                                console.log(`添加Game ${i}红队英雄到Game ${gameNumber}系统禁用: ${championId}`);
                            }
                        });
                    }
                }
            }
            console.log(`Game ${gameNumber}计算出的系统禁用英雄:`, gameSystemBannedChampions);
        }
        
        // 准备会话数据
        const sessionData = {
            session_id: sessionId,
            global_session_id: globalModeSessionId,
            game_number: gameNumber,
            current_mode: 'global',
            current_phase: 'ban1', // 修复：改为ban1，表示第一轮禁用
            current_step: 0,
            whos_turn: 'blue', // 修复：明确指定蓝方开始
            action_type: 'ban', // 修复：明确指定第一个动作是ban
            blue_bans: [],
            red_bans: [],
            blue_picks: [],
            red_picks: [],
            system_banned_champions: gameSystemBannedChampions // 修复：使用计算出的系统禁用英雄
        };
        
        console.log(`创建Game ${gameNumber}会话数据:`, sessionData);
        
        // 创建会话
        const response = await fetch(`${API_BASE_URL}?action=createSession`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        
        const responseData = await response.json();
        
        if (responseData.status === 'error') {
            throw new Error(`Game ${gameNumber}: ${responseData.message}`);
        }
        
        console.log(`Game ${gameNumber} 会话创建成功: ${sessionId}, 初始状态: 蓝方ban1, 系统禁用英雄数量: ${gameSystemBannedChampions.length}`);
        return true;
    } catch (error) {
        console.error(`创建Game ${gameNumber}会话失败:`, error);
        return false;
    }
}

// 预先创建5个游戏会话
async function createAllGameSessions() {
    console.log("开始预先创建5个游戏会话...");
    
    let allSuccess = true;
    for (let gameNumber = 1; gameNumber <= 5; gameNumber++) {
        try {
            // 为每个游戏创建一个会话ID
            const newSessionId = generateSessionId();
            const success = await createGameSession(gameNumber, newSessionId);
            
            if (success) {
                // 更新全局会话中的游戏ID
                const updateSuccess = await updateGameSessionId(gameNumber, newSessionId);
                if (!updateSuccess) {
                    allSuccess = false;
                    console.error(`无法更新Game ${gameNumber}的会话ID到全局会话`);
                }
            } else {
                allSuccess = false;
            }
        } catch (error) {
            allSuccess = false;
            console.error(`创建Game ${gameNumber}会话失败:`, error);
        }
    }
    
    if (allSuccess) {
        console.log("所有游戏会话创建并更新到全局会话成功");
    } else {
        console.warn("部分游戏会话创建或更新失败");
    }
    
    return allSuccess;
}

// 启动全局BP模式的对局
async function startGlobalGame(gameNumber) {
    try {
        console.log(`正在启动Game ${gameNumber}...`);
        
        // 先检查全局会话是否有这个游戏的会话ID
        const response = await fetch(`${API_BASE_URL}?action=getGlobalSession&global_session_id=${globalModeSessionId}`);
        const responseData = await response.json();
        
        if (responseData.status !== 'success' || !responseData.data) {
            throw new Error("无法获取全局会话数据");
        }
        
        const sessionKey = `session_id${gameNumber}`;
        let sessionId = responseData.data[sessionKey];
        
        if (!sessionId) {
            // 如果没有找到会话ID，创建一个新的
            console.log(`未找到Game ${gameNumber}的会话ID，正在创建...`);
            const newSessionId = generateSessionId();
            await createGameSession(gameNumber, newSessionId);
            await updateGameSessionId(gameNumber, newSessionId);
            
            // 再次检查是否更新成功
            const checkResponse = await fetch(`${API_BASE_URL}?action=getGlobalSession&global_session_id=${globalModeSessionId}`);
            const checkData = await checkResponse.json();
            
            if (checkData.status !== 'success' || !checkData.data[sessionKey]) {
                throw new Error(`尝试创建Game ${gameNumber}会话后仍无法获取`);
            }
            
            sessionId = checkData.data[sessionKey];
            console.log(`成功创建并更新Game ${gameNumber}的会话ID: ${sessionId}`);
        } else {
            console.log(`找到Game ${gameNumber}的会话ID: ${sessionId}`);
        }
        
        // 修复：使用新窗口打开分发页面，并明确传递游戏编号参数
        const url = `${window.location.href.split('?')[0]}?mode=distribute&game=${gameNumber}&global_session=${globalModeSessionId}`;
        window.open(url, '_blank');
    } catch (error) {
        console.error(`启动Game ${gameNumber}失败:`, error);
        alert(`启动Game ${gameNumber}失败: ${error.message}`);
    }
}

/**
 * Checks URL parameters to determine if distribution page should be shown
 */
function checkDistributePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const gameId = urlParams.get('game');
    const globalSession = urlParams.get('global_session');
    
    if (mode === 'distribute' && gameId && globalSession) {
        globalModeSessionId = globalSession;
        
        // 确保gameId是有效的数字
        const gameNumber = parseInt(gameId);
        if (!isNaN(gameNumber) && gameNumber > 0) {
            console.log(`检测到分发页面请求，游戏编号: ${gameNumber}`);
            showDistributionPage(gameNumber);
            return true;
        } else {
            console.error(`无效的游戏编号: ${gameId}`);
            alert(`无效的游戏编号: ${gameId}`);
        }
    }
    return false;
}

/**
 * Shows the distribution page for a specific game ID
 * @param {string} gameId - The game ID to distribute
 */
async function showDistributionPage(gameId) {
    try {
        // 隐藏所有其他界面
        document.getElementById('mode-selection').classList.add('hidden');
        document.getElementById('bp-interface').classList.add('hidden');
        document.getElementById('game-selection').classList.add('hidden');
        
        // 创建分发页面（如果不存在）
        if (!document.querySelector('.distribute-page')) {
            createDistributionPage();
        }
        
        const distributePage = document.querySelector('.distribute-page');
        const gameIdEl = distributePage.querySelector('.game-id');
        gameIdEl.textContent = gameId;
        
        // 确保我们有全局会话ID
        if (!globalModeSessionId) {
            const urlParams = new URLSearchParams(window.location.search);
            globalModeSessionId = urlParams.get('global_session');
            
            if (!globalModeSessionId) {
                throw new Error('全局会话ID未找到');
            }
        }
        
        console.log(`正在加载Game ${gameId}的会话ID，全局会话ID: ${globalModeSessionId}`);
        
        // 加载全局会话数据，获取该游戏的会话ID
        const response = await fetch(`${API_BASE_URL}?action=getGlobalSession&global_session_id=${globalModeSessionId}`);
        const responseData = await response.json();
        
        if (responseData.status === 'error') {
            throw new Error(responseData.message);
        }
        
        console.log("获取到的全局会话数据:", responseData.data);
        
        const sessionKey = `session_id${gameId}`;
        const sessionId = responseData.data[sessionKey];
        
        if (!sessionId) {
            // 尝试创建新的会话ID
            console.log(`未找到Game ${gameId}的会话ID，尝试创建新的...`);
            const newSessionId = generateSessionId();
            const creationSuccess = await createGameSession(gameId, newSessionId);
            
            if (!creationSuccess) {
                throw new Error(`未找到Game ${gameId}的会话ID，且创建新会话失败`);
            }
            
            const updateSuccess = await updateGameSessionId(gameId, newSessionId);
            if (!updateSuccess) {
                throw new Error(`创建了新会话ID但无法更新到全局会话中`);
            }
            
            // 使用新创建的会话ID
            console.log(`为Game ${gameId}创建了新的会话ID: ${newSessionId}`);
            
            // 更新链接
            updateDistributionLinks(distributePage, newSessionId);
        } else {
            // 使用现有的会话ID
            console.log(`找到Game ${gameId}的会话ID: ${sessionId}`);
            updateDistributionLinks(distributePage, sessionId);
        }
        
        // 显示分发页面
        distributePage.style.display = 'flex';
        
    } catch (error) {
        console.error("加载游戏会话ID失败:", error);
        alert(`加载游戏会话ID失败: ${error.message}`);
        
        // 出错时返回游戏选择页面
        if (document.getElementById('game-selection')) {
            document.getElementById('game-selection').classList.remove('hidden');
            if (document.querySelector('.distribute-page')) {
                document.querySelector('.distribute-page').style.display = 'none';
            }
        }
    }
}

// 更新分发页面的链接
function updateDistributionLinks(distributePage, sessionId) {
    const blueLink = distributePage.querySelector('.blue-link');
    const redLink = distributePage.querySelector('.red-link');
    const refereeLink = distributePage.querySelector('.referee-link');
    const specLink = distributePage.querySelector('.spec-link');
    
    const baseUrl = window.location.origin + window.location.pathname;
    const gameId = distributePage.querySelector('.game-id').textContent;
    
    // 添加游戏编号参数，确保链接中包含游戏编号
    blueLink.href = `${baseUrl}?session=${sessionId}&role=blue&game=${gameId}&global_session=${globalModeSessionId}`;
    blueLink.textContent = blueLink.href;
    
    redLink.href = `${baseUrl}?session=${sessionId}&role=red&game=${gameId}&global_session=${globalModeSessionId}`;
    redLink.textContent = redLink.href;
    
    refereeLink.href = `${baseUrl}?session=${sessionId}&role=referee&game=${gameId}&global_session=${globalModeSessionId}`;
    refereeLink.textContent = refereeLink.href;
    
    // 观战链接角色应为 observer
    specLink.href = `${baseUrl}?session=${sessionId}&role=observer&game=${gameId}&global_session=${globalModeSessionId}`;
    specLink.textContent = specLink.href;
}

/**
 * Creates the distribution page DOM elements
 */
function createDistributionPage() {
    const distributePage = document.createElement('div');
    distributePage.className = 'distribute-page';
    
    distributePage.innerHTML = `
        <div class="distribute-container">
            <div class="distribute-header">
                <h2>游戏链接分发</h2>
                <p>游戏ID: <span class="game-id"></span></p>
            </div>
            <div class="role-links">
                <div class="link-group blue">
                    <h3>蓝方链接</h3>
                    <a class="blue-link" href="#" target="_blank"></a>
                    <button class="copy-btn" data-link="blue">复制</button>
                </div>
                <div class="link-group red">
                    <h3>红方链接</h3>
                    <a class="red-link" href="#" target="_blank"></a>
                    <button class="copy-btn" data-link="red">复制</button>
                </div>
                <div class="link-group referee">
                    <h3>裁判链接</h3>
                    <a class="referee-link" href="#" target="_blank"></a>
                    <button class="copy-btn" data-link="referee">复制</button>
                </div>
                <div class="link-group spectator">
                    <h3>观战链接</h3>
                    <a class="spec-link" href="#" target="_blank"></a>
                    <button class="copy-btn" data-link="spec">复制</button>
                </div>
            </div>
            <div class="distribute-actions">
                <button class="back-btn">返回</button>
            </div>
            <div class="copy-message">链接已复制！</div>
        </div>
    `;
    
    // 添加CSS样式
    const style = document.createElement('style');
    style.textContent = `
        .distribute-page {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--bg-color);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        
        .distribute-container {
            background-color: var(--panel-bg);
            border-radius: 8px;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
            width: 90%;
            max-width: 800px;
            padding: 20px;
            position: relative;
        }
        
        .distribute-header {
            text-align: center;
            margin-bottom: 20px;
        }
        
        .role-links {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .link-group {
            margin-bottom: 15px;
            padding: 15px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            transition: all 0.3s ease;
        }
        
        .link-group.blue {
            border-color: #1E90FF;
        }
        
        .link-group.red {
            border-color: #FF4500;
        }
        
        .link-group.referee {
            border-color: #9932CC;
        }
        
        .link-group.spectator {
            border-color: #2E8B57;
        }
        
        .link-group:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 10px rgba(0,0,0,0.1);
        }
        
        .link-group h3 {
            margin-top: 0;
            color: var(--highlight-color);
        }
        
        .link-group a {
            display: block;
            word-break: break-all;
            margin-bottom: 10px;
            color: var(--text-color);
            text-decoration: none;
            padding: 5px;
            border: 1px dashed var(--border-color);
            border-radius: 4px;
            background: rgba(0,0,0,0.05);
        }
        
        .link-group a:hover {
            background: rgba(0,0,0,0.1);
        }
        
        .copy-btn {
            background-color: var(--button-bg);
            color: var(--button-text);
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
            font-weight: bold;
            width: 100%;
        }
        
        .copy-btn:hover {
            background-color: var(--highlight-color);
        }
        
        .distribute-actions {
            margin-top: 20px;
            text-align: center;
        }
        
        .back-btn {
            background-color: var(--button-bg);
            color: var(--button-text);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.2s;
        }
        
        .back-btn:hover {
            background-color: var(--highlight-color);
        }
        
        .copy-message {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            display: none;
            z-index: 1100;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(distributePage);
    
    // 添加复制按钮事件
    const copyButtons = distributePage.querySelectorAll('.copy-btn');
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const linkType = button.getAttribute('data-link');
            let linkElement;
            
            switch(linkType) {
                case 'blue':
                    linkElement = distributePage.querySelector('.blue-link');
                    break;
                case 'red':
                    linkElement = distributePage.querySelector('.red-link');
                    break;
                case 'referee':
                    linkElement = distributePage.querySelector('.referee-link');
                    break;
                case 'spec':
                    linkElement = distributePage.querySelector('.spec-link');
                    break;
            }
            
            if (linkElement) {
                const textToCopy = linkElement.href;
                
                // *修复：* 添加剪贴板API的回退方案
                if (navigator.clipboard && window.isSecureContext) {
                    // 使用现代剪贴板API
                    navigator.clipboard.writeText(textToCopy)
                        .then(() => {
                            showCopyMessage(distributePage);
                        })
                        .catch(err => {
                            console.error('使用 Clipboard API 复制失败: ', err);
                            fallbackCopyTextToClipboard(textToCopy, distributePage);
                        });
                } else {
                    // 使用旧的回退方法
                    fallbackCopyTextToClipboard(textToCopy, distributePage);
                }
            }
        });
    });
    
    // 添加返回按钮事件
    const backButton = distributePage.querySelector('.back-btn');
    backButton.addEventListener('click', () => {
        distributePage.style.display = 'none';
        
        // 返回游戏选择页面
        if (document.getElementById('game-selection')) {
            document.getElementById('game-selection').classList.remove('hidden');
        } else {
            document.getElementById('mode-selection').classList.remove('hidden');
        }
    });
}

// *新增：* 显示复制成功消息的辅助函数
function showCopyMessage(distributePage) {
    const copyMessage = distributePage.querySelector('.copy-message');
    copyMessage.style.display = 'block';
    setTimeout(() => {
        copyMessage.style.display = 'none';
    }, 2000);
}

// *新增：* 回退的文本复制方法
function fallbackCopyTextToClipboard(text, distributePage) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // 避免在屏幕上滚动
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = 0;
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopyMessage(distributePage);
        } else {
            console.error('使用 execCommand 回退复制失败');
            alert('复制链接失败');
        }
    } catch (err) {
        console.error('使用 execCommand 回退复制异常: ', err);
        alert('复制链接失败');
    }

    document.body.removeChild(textArea);
}

// 在页面加载时检查是否需要显示分发页面
document.addEventListener('DOMContentLoaded', function() {
    // 检查分发页面参数
    if (!checkDistributePage()) {
        // 如果不是分发页面，则检查其他参数
        checkSessionParameters();
    }
});

// 更新全局会话中的游戏ID
async function updateGameSessionId(gameNumber, sessionId) {
    try {
        const globalData = {
            global_session_id: globalModeSessionId,
            game_number: gameNumber,
            session_id: sessionId
        };
        
        const response = await fetch(`${API_BASE_URL}?action=updateGlobalSessionWithGameId`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(globalData)
        });
        
        const responseData = await response.json();
        
        if (responseData.status === 'error') {
            throw new Error(responseData.message);
        }
        
        console.log(`Game ${gameNumber}的session_id已更新到全局会话`);
        return true;
    } catch (error) {
        console.error(`更新Game ${gameNumber}的session_id失败:`, error);
        return false;
    }
}

// 更新游戏选择按钮状态，显示哪些游戏已经完成
function updateGameSelectionButtons() {
    const gameButtons = document.querySelectorAll('.game-buttons button');
    
    gameButtons.forEach((button, index) => {
        const gameNumber = index + 1;
        
        // 检查这个游戏是否已经有选择
        if (previousGamesPicks[gameNumber] && 
            ((Array.isArray(previousGamesPicks[gameNumber].blue) && previousGamesPicks[gameNumber].blue.length > 0) || 
             (Array.isArray(previousGamesPicks[gameNumber].red) && previousGamesPicks[gameNumber].red.length > 0) ||
             (Array.isArray(previousGamesPicks[gameNumber]) && previousGamesPicks[gameNumber].length > 0))) {
            
            button.classList.add('completed');
            button.textContent = `Game ${gameNumber} (已完成)`;
        } else {
            button.classList.remove('completed');
            button.textContent = `Game ${gameNumber}`;
        }
    });
}

function backToModeSelection() {
    gameSelectionDiv.classList.add('hidden');
    initialScreenContainer.classList.remove('hidden'); // 显示初始屏幕
}

// 添加缓存变量和配置
let globalSessionCache = null;
let gameDataCache = new Map();
const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5分钟缓存过期时间

// 检查缓存是否过期
function isCacheExpired(cacheItem) {
    if (!cacheItem || !cacheItem.timestamp) return true;
    return Date.now() - cacheItem.timestamp > CACHE_EXPIRY_TIME;
}

// 加载前面对局的数据 - 性能优化版本
async function loadPreviousGamesData() {
    if (!globalModeSessionId) return;
    
    // 修复：如果是在游戏选择页面，加载所有游戏数据以正确显示完成状态
    const isGameSelection = !currentGameNumber || currentGameNumber <= 0;
    const maxGameToLoad = isGameSelection ? 5 : currentGameNumber - 1;
    
    if (maxGameToLoad <= 0) {
        console.log("无需加载对局数据");
        previousGamesPicks = {};
        updateGameSelectionButtons();
        return;
    }
    
    try {
        console.log(`尝试加载全局会话数据: ${globalModeSessionId}, 最大游戏编号: ${maxGameToLoad}`);
        
        // 检查缓存，避免重复请求
        let responseData;
        if (globalSessionCache && 
            globalSessionCache.session_id === globalModeSessionId && 
            !isCacheExpired(globalSessionCache)) {
            console.log("使用缓存的全局会话数据");
            responseData = globalSessionCache;
        } else {
            console.log("缓存过期或不存在，重新获取数据");
            const response = await fetch(`${API_BASE_URL}?action=getGlobalSession&global_session_id=${globalModeSessionId}`);
            responseData = await response.json();
            
            // 缓存全局会话数据
            if (responseData.status === 'success' && responseData.data) {
                globalSessionCache = {
                    session_id: globalModeSessionId,
                    data: responseData.data,
                    timestamp: Date.now()
                };
            }
        }
        
        if (responseData.status === 'success' && responseData.data) {
            console.log("收到的全局会话数据:", responseData.data);
            
            // 初始化
            previousGamesPicks = {};
            
            // 收集需要加载的session_id
            const sessionIds = [];
            for (let i = 1; i <= maxGameToLoad; i++) {
                const sessionKey = `session_id${i}`;
                if (responseData.data[sessionKey]) {
                    sessionIds.push({
                        gameNumber: i,
                        sessionId: responseData.data[sessionKey]
                    });
                }
            }
            
            console.log("找到的对局session IDs:", sessionIds);
            
            if (sessionIds.length === 0) {
                console.log("没有找到需要加载的游戏数据");
                updateGameSelectionButtons();
                return;
            }
            
            // 性能优化：并行加载所有游戏数据
            const gameDataPromises = sessionIds.map(async (sessionInfo) => {
                // 检查缓存
                const cacheKey = sessionInfo.sessionId;
                const cachedData = gameDataCache.get(cacheKey);
                
                if (cachedData && !isCacheExpired(cachedData)) {
                    console.log(`使用缓存的Game ${sessionInfo.gameNumber}数据`);
                    return {
                        sessionInfo,
                        gameData: cachedData.data
                    };
                }
                
                try {
                    console.log(`网络请求加载Game ${sessionInfo.gameNumber}数据`);
                    const gameResponse = await fetch(`${API_BASE_URL}?action=getSession&session_id=${sessionInfo.sessionId}`);
                    const gameData = await gameResponse.json();
                    
                    if (gameData.status === 'success' && gameData.data) {
                        // 缓存游戏数据
                        gameDataCache.set(cacheKey, {
                            data: gameData.data,
                            timestamp: Date.now()
                        });
                        
                        return {
                            sessionInfo,
                            gameData: gameData.data
                        };
                    }
                    return null;
                } catch (error) {
                    console.error(`加载Game ${sessionInfo.gameNumber}数据失败:`, error);
                    return null;
                }
            });
            
            // 等待所有请求完成
            const results = await Promise.all(gameDataPromises);
            
            // 处理结果
            results.forEach(result => {
                if (result && result.gameData) {
                    const { sessionInfo, gameData } = result;
                    
                    // 保存游戏数据到previousGamesPicks
                    previousGamesPicks[sessionInfo.gameNumber] = {
                        blue: Array.isArray(gameData.blue_picks) ? 
                            gameData.blue_picks.filter(id => id && !id.startsWith('EmptyBan_')) : [],
                        red: Array.isArray(gameData.red_picks) ? 
                            gameData.red_picks.filter(id => id && !id.startsWith('EmptyBan_')) : []
                    };
                    console.log(`加载Game ${sessionInfo.gameNumber}数据:`, previousGamesPicks[sessionInfo.gameNumber]);
                }
            });
            
            console.log("处理后的全局会话数据:", previousGamesPicks);
        } else {
            // 如果没有现有数据，初始化空对象
            previousGamesPicks = {};
            console.log("开始新的全局会话");
        }
    } catch (error) {
        console.error("加载全局会话数据失败:", error);
        previousGamesPicks = {};
    }
    
    // 更新游戏选择按钮状态
    updateGameSelectionButtons();
}

// 改进的缓存清理函数
function clearGameDataCache() {
    globalSessionCache = null;
    gameDataCache.clear();
    console.log("已清理游戏数据缓存");
}

// 改进的选择性缓存更新函数
function updateGameDataCache(sessionId, gameData) {
    if (sessionId && gameData) {
        gameDataCache.set(sessionId, {
            data: gameData,
            timestamp: Date.now()
        });
        console.log(`更新了session ${sessionId}的缓存数据`);
    }
}

// 添加定期清理过期缓存的功能
function cleanupExpiredCache() {
    // 清理过期的游戏数据缓存
    for (const [key, value] of gameDataCache.entries()) {
        if (isCacheExpired(value)) {
            gameDataCache.delete(key);
            console.log(`清理过期缓存: ${key}`);
        }
    }
    
    // 清理过期的全局会话缓存
    if (globalSessionCache && isCacheExpired(globalSessionCache)) {
        globalSessionCache = null;
        console.log("清理过期的全局会话缓存");
    }
}

// 每5分钟自动清理过期缓存
setInterval(cleanupExpiredCache, 5 * 60 * 1000);

// 从前面对局加载系统禁用英雄
function loadBansFromPreviousGames() {
    // 清空当前系统禁用列表
    systemBannedChampions = [];
    
    // 遍历前面所有对局的选择
    for (let i = 1; i < currentGameNumber; i++) {
        const gamePicks = previousGamesPicks[i];
        if (gamePicks) {
            console.log(`加载Game ${i}的选择进入系统禁用:`, gamePicks);
            
            // 如果是数组格式（老格式）
            if (Array.isArray(gamePicks)) {
                gamePicks.forEach(championId => {
                    if (championId && !championId.startsWith('EmptyBan_') && !systemBannedChampions.includes(championId)) {
                        systemBannedChampions.push(championId);
                    }
                });
            } 
            // 如果是对象格式（新格式）
            else {
                // 将前面对局蓝队的选择加入系统禁用
                if (Array.isArray(gamePicks.blue)) {
                    gamePicks.blue.forEach(championId => {
                        if (championId && !championId.startsWith('EmptyBan_') && !systemBannedChampions.includes(championId)) {
                            systemBannedChampions.push(championId);
                            console.log(`添加Game ${i}蓝队英雄到系统禁用: ${championId}`);
                        }
                    });
                }
                
                // 将前面对局红队的选择加入系统禁用
                if (Array.isArray(gamePicks.red)) {
                    gamePicks.red.forEach(championId => {
                        if (championId && !championId.startsWith('EmptyBan_') && !systemBannedChampions.includes(championId)) {
                            systemBannedChampions.push(championId);
                            console.log(`添加Game ${i}红队英雄到系统禁用: ${championId}`);
                        }
                    });
                }
            }
        }
    }
    
    console.log("已加载前面对局系统禁用英雄:", systemBannedChampions);
    
    // 更新禁用集合
    bannedChampions = new Set(); // 先清空禁用集合
    
    // 添加系统禁用的英雄
    systemBannedChampions.forEach(championId => {
        bannedChampions.add(championId);
    });
    
    // 添加当前游戏已禁用的英雄（不包括EmptyBan）
    blueBans.filter(id => !id.startsWith('EmptyBan_')).forEach(id => bannedChampions.add(id));
    redBans.filter(id => !id.startsWith('EmptyBan_')).forEach(id => bannedChampions.add(id));
    
    // 更新英雄池显示
    renderChampionPool();
    
    // 更新系统禁用英雄显示
    updateSystemBannedDisplay();
    
    console.log("更新后的禁用英雄集合:", bannedChampions);
}

// 保存当前游戏状态到全局会话
async function saveCurrentGameToGlobal() {
    if (!globalModeSessionId || currentGameNumber <= 0 || !sessionId) return;
    
    console.log(`尝试保存Game ${currentGameNumber}的session_id(${sessionId})到全局会话`);
    
    // 准备全局数据 - 只需发送当前游戏的session_id
    const globalData = {
        global_session_id: globalModeSessionId,
        game_number: currentGameNumber,
        session_id: sessionId
    };
    
    try {
        // 发送数据到新的API端点
        const response = await fetch(`${API_BASE_URL}?action=updateGlobalSessionWithGameId`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(globalData)
        });
        
        const responseData = await response.json();
        
        if (responseData.status === 'error') {
            throw new Error(responseData.message);
        }
        
        console.log(`Game ${currentGameNumber}的session_id(${sessionId})已成功保存到全局会话:`, responseData);
        
        // 修复：立即更新内存中的全局游戏数据，确保游戏选择按钮状态正确
        previousGamesPicks[currentGameNumber] = {
            blue: [...bluePicks],
            red: [...redPicks]
        };
        console.log(`Game ${currentGameNumber}数据已更新到previousGamesPicks:`, previousGamesPicks[currentGameNumber]);
        
        // 性能优化：清理全局会话缓存，因为数据已经更新
        if (globalSessionCache && globalSessionCache.session_id === globalModeSessionId) {
            console.log("清理过期的全局会话缓存");
            globalSessionCache = null;
        }
        
        // 修复：立即更新游戏选择按钮状态
        updateGameSelectionButtons();
        
        return true;
    } catch (error) {
        console.error("保存全局会话数据错误:", error);
        alert(`保存全局会话数据失败: ${error.message}`);
        return false;
    }
}

// 创建前面对局信息区域
function createPreviousGamesInfoSection() {
    // 如果是第一局，不显示
    if (currentGameNumber <= 1) return;
    
    // 检查是否已存在
    if (document.getElementById('previous-games-info')) {
        document.getElementById('previous-games-info').remove();
    }
    
    // 创建区域
    const infoSection = document.createElement('div');
    infoSection.id = 'previous-games-info';
    infoSection.className = 'previous-games-info';
    
    // 添加标题
    const title = document.createElement('h4');
    title.textContent = '前面对局已选英雄（自动禁用）';
    infoSection.appendChild(title);
    
    // 创建英雄容器
    const championsContainer = document.createElement('div');
    championsContainer.className = 'previous-games-champions';
    
    // 遍历前面所有对局的选择并添加到容器
    for (let i = 1; i < currentGameNumber; i++) {
        const gamePicks = previousGamesPicks[i];
        if (gamePicks) {
            // 添加蓝队选择的英雄
            if (Array.isArray(gamePicks.blue)) {
                gamePicks.blue.forEach(championId => {
                    addPreviousGameChampion(championsContainer, championId, i, 'blue');
                });
            }
            
            // 添加红队选择的英雄
            if (Array.isArray(gamePicks.red)) {
                gamePicks.red.forEach(championId => {
                    addPreviousGameChampion(championsContainer, championId, i, 'red');
                });
            }
        }
    }
    
    infoSection.appendChild(championsContainer);
    
    // 添加到主界面
    bpInterfaceDiv.insertBefore(infoSection, document.querySelector('.main-content'));
}

// 添加前面对局英雄到显示区域
function addPreviousGameChampion(container, championId, gameNumber, side) {
    const champion = allChampionData.find(c => c.id === championId);
    if (!champion) return;
    
    const champDiv = document.createElement('div');
    champDiv.className = 'previous-games-champion';
    champDiv.title = `Game ${gameNumber} ${side === 'blue' ? '蓝方' : '红方'}: ${champion.name}`;
    
    // 添加图片
    const img = document.createElement('img');
    img.src = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${championId}.png`;
    img.alt = champion.name;
    
    // 添加游戏标签
    const gameLabel = document.createElement('span');
    gameLabel.className = 'game-label';
    gameLabel.textContent = gameNumber;
    gameLabel.style.backgroundColor = side === 'blue' ? '#1E88E5' : '#E53935';
    
    champDiv.appendChild(img);
    champDiv.appendChild(gameLabel);
    container.appendChild(champDiv);
}

// 创建全局会话信息显示区域
function createGlobalSessionDisplay() {
    // 检查是否已存在
    if (document.getElementById('global-session-info')) {
        document.getElementById('global-session-info').remove();
    }
    
    // 创建信息区域
    const infoSection = document.createElement('div');
    infoSection.id = 'global-session-info';
    infoSection.className = 'global-session-info';
    
    // 添加标题
    const title = document.createElement('h4');
    title.textContent = '全局BP会话信息';
    infoSection.appendChild(title);
    
    // 添加全局会话ID
    const globalIdDiv = document.createElement('div');
    globalIdDiv.innerHTML = `<strong>全局会话ID:</strong> <span class="session-id">${globalModeSessionId}</span>`;
    infoSection.appendChild(globalIdDiv);
    
    // 添加复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '复制全局会话ID';
    copyBtn.className = 'copy-button';
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(globalModeSessionId);
        copyBtn.textContent = '已复制!';
        setTimeout(() => {
            copyBtn.textContent = '复制全局会话ID';
        }, 2000);
    };
    infoSection.appendChild(copyBtn);
    
    // 添加各游戏会话ID信息
    const gamesDiv = document.createElement('div');
    gamesDiv.className = 'game-sessions-list';
    gamesDiv.innerHTML = '<h5>各游戏会话ID:</h5>';
    
    // 添加到信息区域
    infoSection.appendChild(gamesDiv);
    
    // 将整个区域添加到游戏选择界面
    gameSelectionDiv.appendChild(infoSection);
    
    // 更新游戏会话信息
    updateGameSessionsDisplay();
}

// 更新游戏会话ID显示
async function updateGameSessionsDisplay() {
    if (!globalModeSessionId) return;
    
    try {
        // 获取全局会话数据
        const response = await fetch(`${API_BASE_URL}?action=getGlobalSession&global_session_id=${globalModeSessionId}`);
        const responseData = await response.json();
        
        if (responseData.status === 'success' && responseData.data) {
            const gameSessionsList = document.querySelector('.game-sessions-list');
            if (!gameSessionsList) return;
            
            // 清除现有内容，保留标题
            const title = gameSessionsList.querySelector('h5');
            gameSessionsList.innerHTML = '';
            if (title) gameSessionsList.appendChild(title);
            
            // 添加各游戏会话信息
            for (let i = 1; i <= 5; i++) {
                const sessionKey = `session_id${i}`;
                const sessionId = responseData.data[sessionKey];
                
                const gameSessionDiv = document.createElement('div');
                gameSessionDiv.className = 'game-session-item';
                
                if (sessionId) {
                    // 已有会话ID
                    gameSessionDiv.innerHTML = `<strong>Game ${i}:</strong> <span class="session-id">${sessionId}</span>`;
                    
                    // 需求2：修改按钮，使其打开链接分发页面
                    const openBtn = document.createElement('a');
                    openBtn.textContent = '打开链接分发';
                    openBtn.className = 'open-button';
                    // 构造分发页面的URL
                    openBtn.href = `${window.location.href.split('?')[0]}?mode=distribute&game=${i}&global_session=${globalModeSessionId}`;
                    openBtn.target = '_blank';
                    gameSessionDiv.appendChild(openBtn);
                    
                    // 添加复制按钮
                    const copyBtn = document.createElement('button');
                    copyBtn.textContent = '复制ID';
                    copyBtn.className = 'copy-button';
                    copyBtn.onclick = () => {
                        navigator.clipboard.writeText(sessionId);
                        copyBtn.textContent = '已复制!';
                        setTimeout(() => {
                            copyBtn.textContent = '复制ID';
                        }, 2000);
                    };
                    gameSessionDiv.appendChild(copyBtn);
                } else {
                    // 没有会话ID
                    gameSessionDiv.innerHTML = `<strong>Game ${i}:</strong> <span class="no-session">尚未创建</span>`;
                }
                
                gameSessionsList.appendChild(gameSessionDiv);
            }
        }
    } catch (error) {
        console.error("获取全局会话数据失败:", error);
    }
}

// 获取标签的中文名称
function getTagChineseName(tag) {
    const tagNameMap = {
        'Fighter': '战士',
        'Tank': '坦克',
        'Mage': '法师',
        'Assassin': '刺客',
        'Marksman': '射手',
        'Support': '辅助'
    };
    
    return tagNameMap[tag] || tag;
}

// --- 重置会话状态函数 ---
function resetSessionState() {
    sessionId = null;
    userRole = 'host';
    isSessionActive = false;
    globalModeSessionId = null;
    currentGameNumber = 0;
    console.log("会话状态已重置");
}

// 性能优化：新增的中央事件处理器
function handleChampionPoolClick(event) {
    const champDiv = event.target.closest('.champion-item');
    if (!champDiv || !champDiv.dataset.id) return;

    const championId = champDiv.dataset.id;

    // --- 裁判逻辑 ---
    // 裁判可以随时切换系统禁用状态
    if (userRole === 'referee') {
        toggleSystemBan(championId);
        return;
    }

    // --- 玩家逻辑 ---
    // 如果不是该玩家的回合或是观察者，则不执行任何操作
    if (!canUserMakeMove()) {
        return;
    }
    
    // 如果BP流程尚未开始，不执行任何操作
    if (!whosTurn || !actionType) {
        console.warn("No action defined yet.");
        return;
    }

    // 忽略对已被禁用/选择的英雄的点击
    if (bannedChampions.has(championId) || pickedChampions.has(championId)) {
        console.warn("Champion already selected/banned:", championId);
        return;
    }
    
    // --- 处理英雄预选 ---
    // 清除上一个预选英雄的样式
    if (pendingChampionId) {
        const oldPendingItem = championPoolDiv.querySelector(`.champion-item[data-id="${pendingChampionId}"]`);
        if(oldPendingItem) oldPendingItem.classList.remove('pending');
    }

    // 设置新的预选英雄
    pendingChampionId = championId;
    console.log("Pending selection:", pendingChampionId);

    // 更新预选区域的UI显示
    updatePendingChampionUI();

    // 为新的预选英雄添加样式
    champDiv.classList.add('pending');

    // 启用确认按钮
    confirmButtonEl.disabled = false;
}

// --- New Function to Create Observer Join UI ---
function createObserverJoinUI() {
    if (!modeSelectionDiv) return;

    const observerDiv = document.createElement('div');
    observerDiv.className = 'observer-join-section';
    observerDiv.style.marginTop = '30px';
    observerDiv.style.paddingTop = '20px';
    observerDiv.style.borderTop = '1px solid var(--border-color)';

    const title = document.createElement('h3');
    title.textContent = '通过ID进入观战';
    observerDiv.appendChild(title);

    const inputContainer = document.createElement('div');
    inputContainer.style.display = 'flex';
    inputContainer.style.gap = '10px';
    inputContainer.style.alignItems = 'center';

    const sessionIdInput = document.createElement('input');
    sessionIdInput.type = 'text';
    sessionIdInput.id = 'observer-session-id-input';
    sessionIdInput.placeholder = '输入对局ID...';
    sessionIdInput.style.flexGrow = '1';
    sessionIdInput.style.padding = '10px';
    sessionIdInput.style.border = '1px solid var(--border-color)';
    sessionIdInput.style.backgroundColor = 'var(--panel-bg)';
    sessionIdInput.style.color = 'var(--text-color)';
    sessionIdInput.style.borderRadius = '4px';

    const joinButton = document.createElement('button');
    joinButton.textContent = '观战';
    joinButton.onclick = async () => {
        const sessionId = sessionIdInput.value.trim();
        if (!sessionId) {
            alert('请输入对局ID。');
            return;
        }

        try {
            // Pre-fetch session data to check for validity and type
            const response = await fetch(`${API_BASE_URL}?action=getSession&session_id=${sessionId}`);
            if (!response.ok) {
                 throw new Error(`无法连接服务器或找不到对局 (HTTP ${response.status})`);
            }
            const responseData = await response.json();

            if (responseData.status === 'success' && responseData.data) {
                const data = responseData.data;
                const baseUrl = window.location.href.split('?')[0];
                let url;
                
                if (data.global_session_id && data.game_number) {
                    console.log(`发现全局对局，游戏编号 ${data.game_number}。正在跳转...`);
                    url = `${baseUrl}?session=${sessionId}&role=observer&game=${data.game_number}&global_session=${data.global_session_id}`;
                } else {
                    console.log("发现常规对局。正在跳转...");
                    url = `${baseUrl}?session=${sessionId}&role=observer`;
                }
                window.location.href = url;
            } else {
                throw new Error(responseData.message || '无法获取对局信息，请检查ID是否正确。');
            }
        } catch (error) {
            console.error("加入观战失败:", error);
            alert(`加入观战失败: ${error.message}`);
        }
    };

    inputContainer.appendChild(sessionIdInput);
    inputContainer.appendChild(joinButton);
    observerDiv.appendChild(inputContainer);

    modeSelectionDiv.appendChild(observerDiv);
}

// --- New function to apply custom button styles ---
function applyCustomButtonStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #confirm-button {
            background-color: #82b948 !important; /* 新的绿色 */
            border-color: #82b948 !important;
            padding: 12px 24px !important; /* 增大按钮 */
            font-size: 16px !important;
            min-width: 120px; /* 确保最小宽度 */
        }
        #confirm-button:hover:not(:disabled) {
            background-color: #6f9e3c !important; /* 稍深的绿色 */
            border-color: #6f9e3c !important;
        }
        #empty-ban-button {
            background-color: #95a5a6 !important; /* 灰色 */
            border-color: #95a5a6 !important;
        }
        #empty-ban-button:hover:not(:disabled) {
            background-color: #7f8c8d !important;
            border-color: #7f8c8d !important;
        }

        /* 需求2：让ID输入框更显眼 */
        #observer-session-id-input {
            border: 2px solid #FFC107 !important; /* 使用一个明确的亮色，避免变量问题 */
            box-shadow: 0 0 5px -2px #FFC107;
            transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;
        }
        #observer-session-id-input:focus {
            outline: none;
            box-shadow: 0 0 8px 0px #FFC107;
            border-color: #FFC107 !important;
        }
    `;
    document.head.appendChild(style);
}