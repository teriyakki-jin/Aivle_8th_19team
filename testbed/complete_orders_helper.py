"""
주문 완료 처리 헬퍼 스크립트
Complete Sample Orders Helper

모델 훈련을 위해 샘플 주문들을 완료 처리합니다.
"""

import os
from sqlalchemy import create_engine, text
from datetime import datetime, timedelta
import random

def complete_sample_orders(db_url: str = None):
    """샘플 주문들을 완료 처리"""
    
    if db_url is None:
        db_url = os.getenv('DATABASE_URL', 
                          'postgresql://postgres:password@localhost:5432/automobile_risk')
    
    print(f"\n{'='*60}")
    print("주문 완료 처리 헬퍼")
    print(f"{'='*60}\n")
    
    try:
        engine = create_engine(db_url)
        
        with engine.connect() as conn:
            # 1. Production에 end_date 설정
            print("1️⃣ Production에 end_date 설정 중...")
            result = conn.execute(text("""
                UPDATE production
                SET end_date = start_date + (random() * interval '5 days' + interval '2 days')
                WHERE production_status = 'COMPLETED' AND end_date IS NULL
            """))
            conn.commit()
            print(f"   ✓ {result.rowcount}개 Production에 end_date 설정 완료")
            
            # 2. FULLY_ALLOCATED → COMPLETED 변경
            print("\n2️⃣ 주문 상태를 COMPLETED로 변경 중...")
            result = conn.execute(text("""
                UPDATE orders o
                SET order_status = 'COMPLETED'
                WHERE order_status = 'FULLY_ALLOCATED'
                AND NOT EXISTS (
                    SELECT 1 
                    FROM order_production op
                    JOIN production p ON op.production_id = p.production_id
                    WHERE op.order_id = o.order_id
                    AND p.production_status != 'COMPLETED'
                )
            """))
            conn.commit()
            print(f"   ✓ {result.rowcount}개 주문을 COMPLETED로 변경")
            
            # 3. 결과 확인
            print(f"\n{'='*60}")
            print("📊 현재 상태")
            print(f"{'='*60}")
            
            result = conn.execute(text("""
                SELECT 
                    o.order_status,
                    COUNT(DISTINCT o.order_id) as order_count,
                    COUNT(DISTINCT CASE WHEN p.end_date IS NOT NULL THEN o.order_id END) as with_end_date
                FROM orders o
                LEFT JOIN order_production op ON o.order_id = op.order_id
                LEFT JOIN production p ON op.production_id = p.production_id
                GROUP BY o.order_status
                ORDER BY o.order_status
            """))
            
            print("\n주문 상태별 통계:")
            for row in result:
                status_label = {
                    'COMPLETED': '완료',
                    'FULLY_ALLOCATED': '전체 할당',
                    'PARTIALLY_ALLOCATED': '일부 할당',
                    'CREATED': '생성',
                    'CANCELLED': '취소'
                }.get(row[0], row[0])
                print(f"  {status_label:15s}: {row[1]:3d}개 (end_date 있음: {row[2]:3d}개)")
            
            # 4. 훈련 가능한 데이터 확인
            result = conn.execute(text("""
                SELECT 
                    COUNT(DISTINCT o.order_id) as trainable_orders,
                    AVG(EXTRACT(epoch FROM (p.end_date - o.due_date)) / 3600) as avg_delay_hours
                FROM orders o
                JOIN order_production op ON o.order_id = op.order_id
                JOIN production p ON op.production_id = p.production_id
                WHERE o.order_status = 'COMPLETED'
                AND p.end_date IS NOT NULL
            """))
            
            row = result.fetchone()
            trainable = row[0] if row[0] else 0
            avg_delay = row[1] if row[1] else 0
            
            print(f"\n{'='*60}")
            print("✅ 훈련 가능한 데이터")
            print(f"{'='*60}")
            print(f"  훈련 가능 주문: {trainable}개")
            if trainable > 0:
                print(f"  평균 지연 시간: {avg_delay:.1f} 시간")
                
                if trainable >= 5:
                    print("\n✅ 모델 훈련 가능!")
                    print("   이제 real_data_testbed.py를 실행하세요.")
                else:
                    print(f"\n⚠️ 훈련 가능한 주문이 {trainable}개뿐입니다.")
                    print("   최소 5개 이상 필요합니다.")
            else:
                print("\n❌ 훈련 가능한 데이터가 없습니다.")
                print("   Production의 production_status를 'COMPLETED'로 설정하고")
                print("   다시 이 스크립트를 실행하세요.")
            
    except Exception as e:
        print(f"\n✗ 오류 발생: {e}")
        return False
    
    return True


if __name__ == '__main__':
    # DATABASE_URL 환경변수를 설정하거나 여기서 직접 지정
    db_url = os.getenv('DATABASE_URL')
    
    if not db_url:
        print("⚠️ DATABASE_URL 환경변수가 설정되지 않았습니다.")
        print("기본값을 사용합니다: postgresql://postgres:password@localhost:5432/automobile_risk")
        db_url = "postgresql://postgres:password@localhost:5432/automobile_risk"
    
    complete_sample_orders(db_url)
