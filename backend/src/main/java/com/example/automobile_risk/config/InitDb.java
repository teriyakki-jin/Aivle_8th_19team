package com.example.automobile_risk.config;

import java.time.LocalDateTime;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.automobile_risk.dto.LoginRequest;
import com.example.automobile_risk.entity.Bom;
import com.example.automobile_risk.entity.Equipment;
import com.example.automobile_risk.entity.Inventory;
import com.example.automobile_risk.entity.InventoryHistory;
import com.example.automobile_risk.entity.MlInputDataset;
import com.example.automobile_risk.entity.Order;
import com.example.automobile_risk.entity.OrderProduction;
import com.example.automobile_risk.entity.Part;
import com.example.automobile_risk.entity.ProcessType;
import com.example.automobile_risk.entity.Production;
import com.example.automobile_risk.entity.VehicleModel;
import com.example.automobile_risk.entity.enumclass.DatasetFormat;
import com.example.automobile_risk.entity.enumclass.InventoryChangeType;
import com.example.automobile_risk.entity.enumclass.Unit;
import com.example.automobile_risk.entity.enumclass.UserRole;
import com.example.automobile_risk.repository.MlInputDatasetRepository;
import com.example.automobile_risk.repository.ProductionDatasetMappingRepository;
import com.example.automobile_risk.repository.UserRepository;
import com.example.automobile_risk.service.AuthService;
import com.example.automobile_risk.service.PressFeatureAggregationService;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
@Slf4j
@RequiredArgsConstructor
@Component
public class InitDb {

    private final InitService initService;

    @PostConstruct
    public void init() {
        initService.vehicleModelDbInit();
        initService.OrderAndProductionDbInit();
    }

    @Component
    @Transactional
    @RequiredArgsConstructor
    static class InitService {

        private final EntityManager em;
        private final PressFeatureAggregationService pressFeatureAggregationService;
        private final AuthService authService;
        private final UserRepository userRepository;
        private final MlInputDatasetRepository mlInputDatasetRepository;
        private final ProductionDatasetMappingRepository productionDatasetMappingRepository;

        public void vehicleModelDbInit() {

            // 이미 초기 데이터가 존재하면 전체 skip
            if (userRepository.findByUsername("admin").isPresent()) {
                log.info("Initial data already exists, skipping DB init");
                return;
            }

            /**
             *  회원가입
             */
            LoginRequest admin = new LoginRequest("admin", "1234", UserRole.ADMIN);
            authService.register(admin);

            LoginRequest productionManager = new LoginRequest("생산", "1234", UserRole.PRODUCTION_MANAGER);
            authService.register(productionManager);

            LoginRequest processManager = new LoginRequest("공정", "1234", UserRole.PROCESS_MANAGER);
            authService.register(processManager);

            /**
             *  차량 모델
             */
            VehicleModel avante_CN8 = createVehicleModel("아반떼 CN8", "준중형 세단", "가솔린", "2026년 하반기 출시 예정인 현대 아반떼의 8세대 모델", true);
            VehicleModel sonata_DN8 = createVehicleModel("쏘나타 DN8", "중형 세단", "하이브리드", "국민차 하면 가장 먼저 떠오르는 명실상부한 대한민국 대표 승용차", true);
            VehicleModel grandeur_GN7 = createVehicleModel("그랜저 GN7", "준대형 세단", "가솔린", "현대자동차의 준대형 세단인 그랜저의 7세대 모델이다. 코드명은 GN7.", true);
            VehicleModel tucson_NX4 = createVehicleModel("투싼 NX4", "준중형 SUV", "가솔린", "현대 투싼의 4세대 모델로, 프로젝트명은 NX4.", true);
            VehicleModel santafe_MX5 = createVehicleModel("싼타페 MX5", "중형 SUV", "하이브리드", "현대 싼타페 5세대 모델로, 프로젝트명은 MX5.", true);

            VehicleModel capser_ax1 = createVehicleModel("캐스퍼 AX1", "경형", "가솔린", "2021년 9월부터 판매 중인 전륜구동 경형 SUV", true);
            VehicleModel kona_sx2 = createVehicleModel("코나 SX2", "소형", "전기", "2017년부터 생산 중인 전륜구동 소형 SUV", true);
            em.persist(avante_CN8);
            em.persist(sonata_DN8);
            em.persist(grandeur_GN7);
            em.persist(tucson_NX4);
            em.persist(santafe_MX5);

            em.persist(capser_ax1);
            em.persist(kona_sx2);

            /**
             *  부품
             */
            Part headLamp = createPart("헤드 램프", "실외", Unit.EA);
            Part tailLamp = createPart("테일 램프", "실외", Unit.EA);
            Part door = createPart("도어", "실외", Unit.EA);
            Part bumper = createPart("범퍼", "실외", Unit.EA);
            Part radiatorGrill = createPart("라디에이터 그릴", "실외", Unit.EA);
            em.persist(headLamp);
            em.persist(tailLamp);
            em.persist(door);
            em.persist(bumper);
            em.persist(radiatorGrill);

            /**
             *  BOM (차량-부품)
             */
            Bom avante_CN8_headLamp = createBom(2, avante_CN8, headLamp);
            Bom avante_CN8_tailLamp = createBom(2, avante_CN8, tailLamp);
            Bom avante_CN8_door = createBom(4, avante_CN8, door);
            Bom avante_CN8_bumper = createBom(2, avante_CN8, bumper);
            Bom avante_CN8_radiatorGrill = createBom(1, avante_CN8, radiatorGrill);
            em.persist(avante_CN8_headLamp);
            em.persist(avante_CN8_tailLamp);
            em.persist(avante_CN8_door);
            em.persist(avante_CN8_bumper);
            em.persist(avante_CN8_radiatorGrill);

            Bom sonata_DN8_headLamp = createBom(2, sonata_DN8, headLamp);
            Bom sonata_DN8_tailLamp = createBom(2, sonata_DN8, tailLamp);
            Bom sonata_DN8_door = createBom(4, sonata_DN8, door);
            Bom sonata_DN8_bumper = createBom(2, sonata_DN8, bumper);
            Bom sonata_DN8_radiatorGrill = createBom(1, sonata_DN8, radiatorGrill);
            em.persist(sonata_DN8_headLamp);
            em.persist(sonata_DN8_tailLamp);
            em.persist(sonata_DN8_door);
            em.persist(sonata_DN8_bumper);
            em.persist(sonata_DN8_radiatorGrill);

            Bom grandeur_MX5_headLamp = createBom(2, grandeur_GN7, headLamp);
            Bom grandeur_MX5_tailLamp = createBom(2, grandeur_GN7, tailLamp);
            Bom grandeur_MX5_door = createBom(4, grandeur_GN7, door);
            Bom grandeur_MX5_bumper = createBom(2, grandeur_GN7, bumper);
            Bom grandeur_MX5_radiatorGrill = createBom(1, grandeur_GN7, radiatorGrill);
            em.persist(grandeur_MX5_headLamp);
            em.persist(grandeur_MX5_tailLamp);
            em.persist(grandeur_MX5_door);
            em.persist(grandeur_MX5_bumper);
            em.persist(grandeur_MX5_radiatorGrill);

            Bom tucson_NX4_headLamp = createBom(2, tucson_NX4, headLamp);
            Bom tucson_NX4_tailLamp = createBom(2, tucson_NX4, tailLamp);
            Bom tucson_NX4_door = createBom(4, tucson_NX4, door);
            Bom tucson_NX4_bumper = createBom(2, tucson_NX4, bumper);
            Bom tucson_NX4_radiatorGrill = createBom(1, tucson_NX4, radiatorGrill);
            em.persist(tucson_NX4_headLamp);
            em.persist(tucson_NX4_tailLamp);
            em.persist(tucson_NX4_door);
            em.persist(tucson_NX4_bumper);
            em.persist(tucson_NX4_radiatorGrill);

            Bom santafe_GN7_headLamp = createBom(2, santafe_MX5, headLamp);
            Bom santafe_GN7_tailLamp = createBom(2, santafe_MX5, tailLamp);
            Bom santafe_GN7_door = createBom(4, santafe_MX5, door);
            Bom santafe_GN7_bumper = createBom(2, santafe_MX5, bumper);
            Bom santafe_GN7_radiatorGrill = createBom(1, santafe_MX5, radiatorGrill);
            em.persist(santafe_GN7_headLamp);
            em.persist(santafe_GN7_tailLamp);
            em.persist(santafe_GN7_door);
            em.persist(santafe_GN7_bumper);
            em.persist(santafe_GN7_radiatorGrill);

            Bom capser_ax1_headLamp = createBom(2, capser_ax1, headLamp);
            Bom capser_ax1_tailLamp = createBom(2, capser_ax1, tailLamp);
            Bom capser_ax1_door = createBom(4, capser_ax1, door);
            Bom capser_ax1_bumper = createBom(2, capser_ax1, bumper);
            Bom capser_ax1_radiatorGrill = createBom(1, capser_ax1, radiatorGrill);
            em.persist(capser_ax1_headLamp);
            em.persist(capser_ax1_tailLamp);
            em.persist(capser_ax1_door);
            em.persist(capser_ax1_bumper);
            em.persist(capser_ax1_radiatorGrill);

            Bom kona_sx2_headLamp = createBom(2, kona_sx2, headLamp);
            Bom kona_sx2_tailLamp = createBom(2, kona_sx2, tailLamp);
            Bom kona_sx2_door = createBom(4, kona_sx2, door);
            Bom kona_sx2_bumper = createBom(2, kona_sx2, bumper);
            Bom kona_sx2_radiatorGrill = createBom(1, kona_sx2, radiatorGrill);
            em.persist(kona_sx2_headLamp);
            em.persist(kona_sx2_tailLamp);
            em.persist(kona_sx2_door);
            em.persist(kona_sx2_bumper);
            em.persist(kona_sx2_radiatorGrill);


            /**
             *  현 재고
             */
            Inventory inventory_headLamp = Inventory.of(headLamp, 1000);
            Inventory inventory_tailLamp = Inventory.of(tailLamp, 1000);
            Inventory inventory_door = Inventory.of(door, 1000);
            Inventory inventory_bumper = Inventory.of(bumper, 1000);
            Inventory inventory_radiatorGrill = Inventory.of(radiatorGrill, 1000);
            em.persist(inventory_headLamp);
            em.persist(inventory_tailLamp);
            em.persist(inventory_door);
            em.persist(inventory_bumper);
            em.persist(inventory_radiatorGrill);

            /**
             *  재고 이력
             */
            InventoryHistory ih_headLamp_IN_10 = InventoryHistory.of(headLamp, 10, inventory_headLamp.getCurrentQty(), LocalDateTime.now(), InventoryChangeType.IN);
            InventoryHistory ih_tailLamp_OUT_10 = InventoryHistory.of(tailLamp, -10, inventory_headLamp.getCurrentQty(), LocalDateTime.now(), InventoryChangeType.OUT);
            InventoryHistory ih_door_OUT_20 = InventoryHistory.of(door, 20, inventory_headLamp.getCurrentQty(), LocalDateTime.now(), InventoryChangeType.IN);
            InventoryHistory ih_bumper_OUT_10 = InventoryHistory.of(bumper, -10, inventory_headLamp.getCurrentQty(), LocalDateTime.now(), InventoryChangeType.ADJUST);
            InventoryHistory ih_radiatorGrill_OUT_50 = InventoryHistory.of(radiatorGrill, -50, inventory_headLamp.getCurrentQty(), LocalDateTime.now(), InventoryChangeType.SCRAP);
            em.persist(ih_headLamp_IN_10);
            em.persist(ih_tailLamp_OUT_10);
            em.persist(ih_door_OUT_20);
            em.persist(ih_bumper_OUT_10);
            em.persist(ih_radiatorGrill_OUT_50);

            /**
             *  주문
             */
            Order order1 = Order.createOrder(LocalDateTime.now(), LocalDateTime.now().plusDays(7), 10, avante_CN8);
            Order order2 = Order.createOrder(LocalDateTime.now(), LocalDateTime.now().plusDays(7), 5, sonata_DN8);
            Order order3 = Order.createOrder(LocalDateTime.now(), LocalDateTime.now().plusDays(7), 1, grandeur_GN7);
            em.persist(order1);
            em.persist(order2);
            em.persist(order3);

            /**
             *  생산 (주문과 1:1 연결)
             */
            Production production1 = Production.of(order1.getOrderDate(), order1.getOrderQty(), avante_CN8);
            Production production2 = Production.of(order2.getOrderDate(), order2.getOrderQty(), sonata_DN8);
            Production production3 = Production.of(order3.getOrderDate(), order3.getOrderQty(), grandeur_GN7);
            em.persist(production1);
            em.persist(production2);
            em.persist(production3);

            OrderProduction op1 = OrderProduction.createOrderProduction(order1, production1, order1.getOrderQty());
            OrderProduction op2 = OrderProduction.createOrderProduction(order2, production2, order2.getOrderQty());
            OrderProduction op3 = OrderProduction.createOrderProduction(order3, production3, order3.getOrderQty());
            em.persist(op1);
            em.persist(op2);
            em.persist(op3);

            /**
             *  공정 타입
             */
            ProcessType stamping = ProcessType.createProcessType("프레스", 1, true);
            ProcessType welding = ProcessType.createProcessType("차체조립(용접)", 2, true);
            ProcessType paint= ProcessType.createProcessType("도장", 3, true);
            ProcessType assembly = ProcessType.createProcessType("의장", 4, true);
            ProcessType inspection = ProcessType.createProcessType("검수", 5, true);
            em.persist(stamping);
            em.persist(welding);
            em.persist(assembly);
            em.persist(paint);
            em.persist(inspection);

            /**
             *  설비
             */
            Equipment stampingEquipment_1 = Equipment.createEquipment("프레스 1호기", stamping);
            Equipment stampingEquipment_2 = Equipment.createEquipment("프레스 2호기", stamping);
            Equipment weldingEquipment_1 = Equipment.createEquipment("용접 1호기", welding);
            Equipment assemblyEquipment_1 = Equipment.createEquipment("조립 1호기", assembly);
            Equipment paintEquipment_1 = Equipment.createEquipment("도장 1호기", paint);
            Equipment inspectionEquipment_1 = Equipment.createEquipment("검수 1호기", inspection);
            em.persist(stampingEquipment_1);
            em.persist(stampingEquipment_2);
            em.persist(weldingEquipment_1);
            em.persist(paintEquipment_1);
            em.persist(assemblyEquipment_1);
            em.persist(inspectionEquipment_1);

            /**
             *  ML 입력 데이터셋 + 생산 매핑 (초기)
             */
            if (mlInputDatasetRepository.count() == 0) {
                MlInputDataset pressJson = MlInputDataset.builder()
                        .processName("프레스")
                        .serviceType("press_vibration")
                        .name("press_vibration_order1")
                        .format(DatasetFormat.JSON)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_1\\\\press\\\\press_vibration_unit01.json")
                        .description("press vibration json sample")
                        .build();

                MlInputDataset pressImg1 = MlInputDataset.builder()
                        .processName("프레스")
                        .serviceType("press_image")
                        .name("press_image_unit01_p1")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_1\\\\press\\\\press_image_unit01.jpg")
                        .description("press image sample for production 1")
                        .build();

                MlInputDataset pressImg2 = MlInputDataset.builder()
                        .processName("프레스")
                        .serviceType("press_image")
                        .name("press_image_unit01_p2")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_2\\\\press\\\\press_image_unit01.jpg")
                        .description("press image sample for production 2")
                        .build();

                MlInputDataset pressImg3 = MlInputDataset.builder()
                        .processName("프레스")
                        .serviceType("press_image")
                        .name("press_image_unit01_p3")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_3\\\\press\\\\press_image_unit01.jpg")
                        .description("press image sample for production 3")
                        .build();

                MlInputDataset weldImg1 = MlInputDataset.builder()
                        .processName("용접")
                        .serviceType("welding_image")
                        .name("welding_unit01_p1")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_1\\\\welding\\\\welding_unit01.jpg")
                        .description("welding image sample for production 1")
                        .build();

                MlInputDataset weldImg2 = MlInputDataset.builder()
                        .processName("용접")
                        .serviceType("welding_image")
                        .name("welding_unit01_p2")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_2\\\\welding\\\\welding_unit01.jpg")
                        .description("welding image sample for production 2")
                        .build();

                MlInputDataset weldImg3 = MlInputDataset.builder()
                        .processName("용접")
                        .serviceType("welding_image")
                        .name("welding_unit01_p3")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_3\\\\welding\\\\welding_unit01.jpg")
                        .description("welding image sample for production 3")
                        .build();

                MlInputDataset paintImg1 = MlInputDataset.builder()
                        .processName("도장")
                        .serviceType("paint")
                        .name("paint_unit01_p1")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_1\\\\paint\\\\paint_unit01.jpg")
                        .description("paint image sample for production 1")
                        .build();

                MlInputDataset paintImg2 = MlInputDataset.builder()
                        .processName("도장")
                        .serviceType("paint")
                        .name("paint_unit01_p2")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_2\\\\paint\\\\paint_unit01.jpg")
                        .description("paint image sample for production 2")
                        .build();

                MlInputDataset paintImg3 = MlInputDataset.builder()
                        .processName("도장")
                        .serviceType("paint")
                        .name("paint_unit01_p3")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_3\\\\paint\\\\paint_unit01.jpg")
                        .description("paint image sample for production 3")
                        .build();

                MlInputDataset bodyImg1 = MlInputDataset.builder()
                        .processName("조립")
                        .serviceType("body_assembly")
                        .name("body_assembly_parts_p1")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_1\\\\body_assembly")
                        .description("body assembly part images for production 1")
                        .build();

                MlInputDataset bodyImg2 = MlInputDataset.builder()
                        .processName("조립")
                        .serviceType("body_assembly")
                        .name("body_assembly_parts_p2")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_2\\\\body_assembly")
                        .description("body assembly part images for production 2")
                        .build();

                MlInputDataset bodyImg3 = MlInputDataset.builder()
                        .processName("조립")
                        .serviceType("body_assembly")
                        .name("body_assembly_parts_p3")
                        .format(DatasetFormat.IMAGE)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_3\\\\body_assembly")
                        .description("body assembly part images for production 3")
                        .build();

                MlInputDataset inspectionCsv1 = MlInputDataset.builder()
                        .processName("검사")
                        .serviceType("windshield")
                        .name("windshield_left_p1")
                        .format(DatasetFormat.CSV)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_1\\\\inspection\\\\windshield_left.csv")
                        .description("windshield csv sample for production 1")
                        .build();

                MlInputDataset inspectionCsv2 = MlInputDataset.builder()
                        .processName("검사")
                        .serviceType("windshield")
                        .name("windshield_left_p2")
                        .format(DatasetFormat.CSV)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_2\\\\inspection\\\\windshield_left.csv")
                        .description("windshield csv sample for production 2")
                        .build();

                MlInputDataset inspectionCsv3 = MlInputDataset.builder()
                        .processName("검사")
                        .serviceType("windshield")
                        .name("windshield_left_p3")
                        .format(DatasetFormat.CSV)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_3\\\\inspection\\\\windshield_left.csv")
                        .description("windshield csv sample for production 3")
                        .build();

                MlInputDataset inspectionEngine1 = MlInputDataset.builder()
                        .processName("검사")
                        .serviceType("engine")
                        .name("engine_p1")
                        .format(DatasetFormat.ARFF)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_1\\\\inspection\\\\engine.arff")
                        .description("engine arff sample for production 1")
                        .build();

                MlInputDataset inspectionEngine2 = MlInputDataset.builder()
                        .processName("검사")
                        .serviceType("engine")
                        .name("engine_p2")
                        .format(DatasetFormat.ARFF)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_2\\\\inspection\\\\engine.arff")
                        .description("engine arff sample for production 2")
                        .build();

                MlInputDataset inspectionEngine3 = MlInputDataset.builder()
                        .processName("검사")
                        .serviceType("engine")
                        .name("engine_p3")
                        .format(DatasetFormat.ARFF)
                        .storageKey("C:\\\\pjt\\\\Aivle_8th_19team\\\\ml-service\\\\datasets\\\\production_3\\\\inspection\\\\engine.arff")
                        .description("engine arff sample for production 3")
                        .build();

                mlInputDatasetRepository.save(pressJson);
                mlInputDatasetRepository.save(pressImg1);
                mlInputDatasetRepository.save(pressImg2);
                mlInputDatasetRepository.save(pressImg3);
                mlInputDatasetRepository.save(weldImg1);
                mlInputDatasetRepository.save(weldImg2);
                mlInputDatasetRepository.save(weldImg3);
                mlInputDatasetRepository.save(paintImg1);
                mlInputDatasetRepository.save(paintImg2);
                mlInputDatasetRepository.save(paintImg3);
                mlInputDatasetRepository.save(bodyImg1);
                mlInputDatasetRepository.save(bodyImg2);
                mlInputDatasetRepository.save(bodyImg3);
                mlInputDatasetRepository.save(inspectionCsv1);
                mlInputDatasetRepository.save(inspectionCsv2);
                mlInputDatasetRepository.save(inspectionCsv3);
                mlInputDatasetRepository.save(inspectionEngine1);
                mlInputDatasetRepository.save(inspectionEngine2);
                mlInputDatasetRepository.save(inspectionEngine3);

                // 생산 1~3에 공정별 데이터셋 매핑
                mapDatasetIfEmpty(production1.getId(), "프레스", pressJson);
                mapDatasetIfEmpty(production1.getId(), "프레스", pressImg1);
                mapDatasetIfEmpty(production1.getId(), "용접", weldImg1);
                mapDatasetIfEmpty(production1.getId(), "도장", paintImg1);
                mapDatasetIfEmpty(production1.getId(), "조립", bodyImg1);
                mapDatasetIfEmpty(production1.getId(), "검사", inspectionCsv1);
                mapDatasetIfEmpty(production1.getId(), "검사", inspectionEngine1);

                mapDatasetIfEmpty(production2.getId(), "프레스", pressJson);
                mapDatasetIfEmpty(production2.getId(), "프레스", pressImg2);
                mapDatasetIfEmpty(production2.getId(), "용접", weldImg2);
                mapDatasetIfEmpty(production2.getId(), "도장", paintImg2);
                mapDatasetIfEmpty(production2.getId(), "조립", bodyImg2);
                mapDatasetIfEmpty(production2.getId(), "검사", inspectionCsv2);
                mapDatasetIfEmpty(production2.getId(), "검사", inspectionEngine2);

                mapDatasetIfEmpty(production3.getId(), "프레스", pressJson);
                mapDatasetIfEmpty(production3.getId(), "프레스", pressImg3);
                mapDatasetIfEmpty(production3.getId(), "용접", weldImg3);
                mapDatasetIfEmpty(production3.getId(), "도장", paintImg3);
                mapDatasetIfEmpty(production3.getId(), "조립", bodyImg3);
                mapDatasetIfEmpty(production3.getId(), "검사", inspectionCsv3);
                mapDatasetIfEmpty(production3.getId(), "검사", inspectionEngine3);
            }
        }

        public void OrderAndProductionDbInit() {
        }

        private static VehicleModel createVehicleModel(String modelName, String segment, String fuel, String description, boolean isActive) {

            return VehicleModel.builder()
                    .modelName(modelName)
                    .segment(segment)
                    .fuel(fuel)
                    .description(description)
                    .isActive(isActive)
                    .build();
        }

        private static Part createPart(String partName, String partType, Unit unit) {

            return Part.builder()
                    .partName(partName)
                    .partType(partType)
                    .unit(unit)
                    .build();
        }

        private static Bom createBom(int requiredQty, VehicleModel vehicleModel, Part part) {

            return Bom.builder()
                    .requiredQty(requiredQty)
                    .vehicleModel(vehicleModel)
                    .part(part)
                    .build();
        }

        private void mapDatasetIfEmpty(Long productionId, String processName, MlInputDataset dataset) {
            if (productionId == null || dataset == null) return;
            boolean exists = productionDatasetMappingRepository
                    .findByProductionIdAndProcessNameAndServiceType(productionId, processName, dataset.getServiceType())
                    .isPresent();
            if (exists) return;

            em.createNativeQuery(
                            "insert into production_dataset_mappings (created_date, last_modified_date, process_name, service_type, production_id, ml_input_dataset_id) values (now(), now(), ?, ?, ?, ?)")
                    .setParameter(1, processName)
                    .setParameter(2, dataset.getServiceType())
                    .setParameter(3, productionId)
                    .setParameter(4, dataset.getId())
                    .executeUpdate();
        }

    }
}
