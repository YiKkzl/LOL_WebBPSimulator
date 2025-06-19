<?php
// 数据库连接配置
$db_host = 'localhost'; // 数据库服务器地址
$db_user = 'ts_yikk_top'; // 替换为您的数据库用户名
$db_pass = 'tNyz7cc26j25DmG3'; // 替换为您的数据库密码
$db_name = 'ts_yikk_top'; // 替换为您的数据库名称

// 创建数据库连接
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

// 检查连接是否成功
if ($conn->connect_error) {
    die("数据库连接失败: " . $conn->connect_error);
}

// 设置字符集为 utf8
$conn->set_charset("utf8");
?> 