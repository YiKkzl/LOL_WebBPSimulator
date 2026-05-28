CREATE USER IF NOT EXISTS 'lolbp_ro'@'%' IDENTIFIED BY 'lolbp_readonly_password';
GRANT SELECT, SHOW VIEW ON lolbp_test.* TO 'lolbp_ro'@'%';
FLUSH PRIVILEGES;
