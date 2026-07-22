DROP EVENT IF EXISTS cleanup_expired_bp_data;

DELIMITER //

CREATE EVENT cleanup_expired_bp_data
ON SCHEDULE EVERY 1 HOUR
STARTS CURRENT_TIMESTAMP
ON COMPLETION PRESERVE
ENABLE
DO
BEGIN
  DECLARE cutoff_time DATETIME;
  SET cutoff_time = CURRENT_TIMESTAMP - INTERVAL 24 HOUR;

  DELETE FROM session_activity
  WHERE created_at < cutoff_time
     OR session_id IN (
       SELECT session_id
       FROM bp_sessions
       WHERE last_updated < cutoff_time
     );

  DELETE FROM bp_sessions
  WHERE last_updated < cutoff_time;

  DELETE FROM global_games
  WHERE updated_at < cutoff_time;
END//

DELIMITER ;
