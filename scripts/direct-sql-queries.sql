-- NEON POSTGRESQL DIRECT SQL DEBUGGING QUERIES
-- Critical queries to diagnose QR persistence issues

-- =================================================================
-- 1. CONNECTION AND TRANSACTION ANALYSIS
-- =================================================================

-- Check current connection and transaction status
SELECT 
    current_database() as database_name,
    current_user as current_user,
    inet_server_addr() as server_ip,
    inet_server_port() as server_port,
    pg_backend_pid() as backend_pid,
    application_name,
    client_addr,
    state,
    backend_start,
    xact_start,
    query_start,
    state_change
FROM pg_stat_activity 
WHERE pid = pg_backend_pid();

-- Check PostgreSQL version and Neon-specific information
SELECT version() as postgresql_version;

-- Critical PostgreSQL settings for transaction consistency
SELECT 
    name,
    setting,
    context,
    short_desc,
    source
FROM pg_settings 
WHERE name IN (
    'default_transaction_isolation',
    'transaction_isolation', 
    'synchronous_commit',
    'fsync',
    'wal_level',
    'max_connections',
    'shared_preload_libraries',
    'log_statement',
    'log_min_duration_statement'
)
ORDER BY name;

-- Check for active locks that might cause consistency issues
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process,
    blocked_locks.locktype,
    blocked_locks.mode
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- =================================================================
-- 2. DATABASE STATE ANALYSIS
-- =================================================================

-- Count total records in all tables
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'qr_codes' as table_name, COUNT(*) as record_count FROM qr_codes
UNION ALL
SELECT 'scans' as table_name, COUNT(*) as record_count FROM scans
UNION ALL
SELECT 'qr_variants' as table_name, COUNT(*) as record_count FROM qr_variants
ORDER BY table_name;

-- Find the anonymous user and their QR codes
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.plan,
    u.created_at as user_created,
    COUNT(qr.id) as qr_count
FROM users u
LEFT JOIN qr_codes qr ON u.id = qr.user_id
WHERE u.email LIKE '%anonymous%' OR u.email LIKE '%demo.local%'
GROUP BY u.id, u.email, u.name, u.plan, u.created_at
ORDER BY u.created_at DESC;

-- Get recent QR codes with user information
SELECT 
    qr.id,
    qr.short_id,
    qr.name,
    qr.target_url,
    qr.is_active,
    qr.created_at,
    qr.updated_at,
    u.email as user_email,
    u.name as user_name,
    EXTRACT(EPOCH FROM (NOW() - qr.created_at)) as seconds_since_creation
FROM qr_codes qr
JOIN users u ON qr.user_id = u.id
ORDER BY qr.created_at DESC
LIMIT 10;

-- Check for orphaned QR codes (without users)
SELECT 
    qr.id,
    qr.short_id,
    qr.name,
    qr.user_id,
    qr.created_at
FROM qr_codes qr
LEFT JOIN users u ON qr.user_id = u.id
WHERE u.id IS NULL;

-- =================================================================
-- 3. CONSISTENCY VERIFICATION QUERIES
-- =================================================================

-- Test read-after-write consistency with a test record
-- (Run these queries in sequence to test persistence)

-- Step 1: Create a test user (if not exists)
INSERT INTO users (id, email, name, plan, created_at, updated_at)
VALUES ('test-consistency-user', 'consistency-test@debug.local', 'Consistency Test User', 'FREE', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
RETURNING id, email, created_at;

-- Step 2: Create a test QR code
INSERT INTO qr_codes (
    id, 
    name, 
    short_id, 
    target_url, 
    is_active, 
    enable_ai, 
    total_scans, 
    user_id, 
    created_at, 
    updated_at,
    qr_color,
    qr_size,
    qr_style
) VALUES (
    'test-consistency-qr-' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'Consistency Test QR',
    'TEST_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'https://example.com/consistency-test',
    true,
    false,
    0,
    'test-consistency-user',
    NOW(),
    NOW(),
    '#000000',
    256,
    'classic'
) RETURNING id, short_id, created_at;

-- Step 3: Immediately verify the QR code exists
-- (This should be run immediately after Step 2)
SELECT 
    id,
    short_id,
    name,
    target_url,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_since_creation
FROM qr_codes 
WHERE short_id LIKE 'TEST_%'
ORDER BY created_at DESC
LIMIT 1;

-- Step 4: Check if the QR is visible to user queries
SELECT 
    qr.id,
    qr.short_id,
    qr.name,
    qr.created_at,
    u.email
FROM qr_codes qr
JOIN users u ON qr.user_id = u.id
WHERE u.email = 'consistency-test@debug.local'
ORDER BY qr.created_at DESC;

-- =================================================================
-- 4. NEON-SPECIFIC DIAGNOSTIC QUERIES
-- =================================================================

-- Check connection pool status
SELECT 
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_connections,
    count(*) FILTER (WHERE state = 'idle') as idle_connections,
    count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
    count(*) FILTER (WHERE state = 'idle in transaction (aborted)') as aborted_transactions
FROM pg_stat_activity;

-- Detailed connection analysis
SELECT 
    application_name,
    state,
    backend_start,
    xact_start,
    query_start,
    state_change,
    wait_event_type,
    wait_event,
    CASE 
        WHEN state = 'active' THEN query 
        ELSE '<idle>'
    END as current_query
FROM pg_stat_activity
WHERE pid != pg_backend_pid()
ORDER BY backend_start DESC;

-- Check for any replication or read replica issues
SELECT 
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    sync_state
FROM pg_stat_replication;

-- Check database statistics that might indicate consistency issues
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('users', 'qr_codes', 'scans')
ORDER BY tablename;

-- =================================================================
-- 5. TRANSACTION LOG ANALYSIS
-- =================================================================

-- Check for long-running transactions
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state,
    application_name
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
    AND state != 'idle';

-- Check transaction ID wraparound status
SELECT 
    datname,
    age(datfrozenxid) as transaction_age,
    CASE 
        WHEN age(datfrozenxid) > 1000000000 THEN 'WARNING: High transaction age'
        ELSE 'OK'
    END as status
FROM pg_database
WHERE datname = current_database();

-- =================================================================
-- 6. DEBUGGING CLEANUP QUERIES
-- =================================================================

-- Clean up test data (run after debugging)
DELETE FROM qr_codes WHERE short_id LIKE 'TEST_%' OR name LIKE '%Consistency Test%';
DELETE FROM users WHERE email = 'consistency-test@debug.local';

-- =================================================================
-- 7. PERFORMANCE ANALYSIS QUERIES
-- =================================================================

-- Check index usage for QR table
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'Unused Index'
        WHEN idx_tup_read = 0 THEN 'Zero Reads'
        ELSE 'Active'
    END as index_status
FROM pg_stat_user_indexes
WHERE tablename = 'qr_codes'
ORDER BY idx_scan DESC;

-- Check table size and bloat
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('users', 'qr_codes', 'scans')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =================================================================
-- MANUAL TESTING PROCEDURE
-- =================================================================
/*
MANUAL TESTING STEPS:

1. Run Section 1 queries to check connection status
2. Run Section 2 queries to analyze current database state
3. Execute Section 3 queries IN SEQUENCE to test consistency:
   - Run Step 1 (create test user)
   - Run Step 2 (create test QR)
   - IMMEDIATELY run Step 3 (verify QR exists)
   - Run Step 4 (check user QR visibility)
4. Run Section 4 for Neon-specific diagnostics
5. Run Section 6 cleanup queries when done

EXPECTED RESULTS:
- All consistency test queries should return the created records
- No blocking locks should be present
- Connection pool should show healthy status
- Transaction isolation should be 'read committed'

FAILURE INDICATORS:
- Step 3 returns no results (QR not found immediately)
- Step 4 returns empty result (QR not visible to user)
- Blocking locks present
- High dead tuple count
- Unusual transaction isolation levels
*/