REVOKE ALL PRIVILEGES ON attendance.* FROM 'attendance_app'@'%';

GRANT SELECT, INSERT, UPDATE, DELETE
ON attendance.*
TO 'attendance_app'@'%';
