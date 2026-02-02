-- 샘플 주문을 완료 처리하는 SQL 스크립트
-- 납기 예측 모델 훈련을 위해 실행하세요

-- 1단계: Production에 end_date 설정 (시작일 + 랜덤 2-7일)
UPDATE production
SET end_date = start_date + (random() * interval '5 days' + interval '2 days')
WHERE production_status = 'COMPLETED' AND end_date IS NULL;

-- 2단계: FULLY_ALLOCATED 주문 중 일부를 COMPLETED로 변경
-- (production이 모두 COMPLETED인 경우만)
UPDATE orders o
SET order_status = 'COMPLETED'
WHERE order_status = 'FULLY_ALLOCATED'
AND NOT EXISTS (
    SELECT 1 
    FROM order_production op
    JOIN production p ON op.production_id = p.production_id
    WHERE op.order_id = o.order_id
    AND p.production_status != 'COMPLETED'
);

-- 3단계: 확인용 쿼리
SELECT 
    o.order_status,
    COUNT(*) as count,
    COUNT(CASE WHEN p.end_date IS NOT NULL THEN 1 END) as with_end_date
FROM orders o
LEFT JOIN order_production op ON o.order_id = op.order_id
LEFT JOIN production p ON op.production_id = p.production_id
GROUP BY o.order_status
ORDER BY o.order_status;

-- 4단계: 훈련 가능한 데이터 확인
SELECT 
    COUNT(DISTINCT o.order_id) as trainable_orders,
    AVG(EXTRACT(epoch FROM (p.end_date - o.due_date)) / 3600) as avg_delay_hours
FROM orders o
JOIN order_production op ON o.order_id = op.order_id
JOIN production p ON op.production_id = p.production_id
WHERE o.order_status = 'COMPLETED'
AND p.end_date IS NOT NULL;
