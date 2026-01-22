import { useState } from 'react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { CheckCircle, XCircle, Upload, Sparkles } from 'lucide-react';
//import img1 from '@/assets/defects/runs_sags_fliph_b197f719-c6c8-4a96-bb05-468537ef79f4_jpg.rf.17505271375f7d089875e31acf7ea367.jpg'; 

interface DefectImage {
  id: number;
  imageUrl: string;
  status: 'normal' | 'defect';
  defectType?: string;
  confidence: number;
  location: string;
  timestamp: string;
}

export function DefectImageAnalysis() {
  const [selectedImage, setSelectedImage] = useState<DefectImage | null>(null);

  const images: DefectImage[] = [
    {
      id: 1,
      imageUrl: '/val_predictions/runs_sags_fliph_b197f719-c6c8-4a96-bb05-468537ef79f4_jpg.rf.17505271375f7d089875e31acf7ea367.jpg',
      status: 'normal',
      confidence: 99.2,
      location: '구역 A - 차량 001',
      timestamp: '2026-01-19 13:45:12'
    },
    {
      id: 2,
      imageUrl: 'https://images.unsplash.com/photo-1692119439873-7a4be83beeea?w=400',
      status: 'defect',
      defectType: '스크래치',
      confidence: 96.8,
      location: '구역 B - 차량 023',
      timestamp: '2026-01-19 13:42:08'
    },
    {
      id: 3,
      imageUrl: 'https://images.unsplash.com/photo-1655260708815-630452ee45d3?w=400',
      status: 'defect',
      defectType: '먼지 오염',
      confidence: 94.5,
      location: '구역 C - 차량 045',
      timestamp: '2026-01-19 13:38:22'
    },
    {
      id: 4,
      imageUrl: 'https://images.unsplash.com/photo-1627401193264-a8d637d8076a?w=400',
      status: 'normal',
      confidence: 98.7,
      location: '구역 A - 차량 012',
      timestamp: '2026-01-19 13:35:45'
    },
    {
      id: 5,
      imageUrl: 'https://images.unsplash.com/photo-1747867564879-a95aebc2f940?w=400',
      status: 'normal',
      confidence: 97.3,
      location: '구역 D - 차량 067',
      timestamp: '2026-01-19 13:32:11'
    },
    {
      id: 6,
      imageUrl: 'https://images.unsplash.com/photo-1758972687682-275996900e2a?w=400',
      status: 'defect',
      defectType: '색상 불균일',
      confidence: 91.2,
      location: '구역 B - 차량 089',
      timestamp: '2026-01-19 13:28:37'
    }
  ];

  return (
    <div className="bg-white rounded-[14px] border border-[#e5e7eb] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[#101828] text-[18px] font-bold leading-[28px]">
            결함 이미지 분석
          </h3>
          <p className="text-[#4a5565] text-[14px] leading-[20px] mt-1">
            AI 비전 검사 결과
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#155dfc] text-white rounded-lg hover:bg-[#1248c9] transition-colors">
          <Upload className="w-4 h-4" />
          <span className="text-[14px] font-medium">이미지 업로드</span>
        </button>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {images.map((image) => (
          <div
            key={image.id}
            onClick={() => setSelectedImage(image)}
            className="relative group cursor-pointer rounded-lg overflow-hidden border-2 hover:border-[#155dfc] transition-all"
            style={{
              borderColor: selectedImage?.id === image.id ? '#155dfc' : '#e5e7eb'
            }}
          >
            <div className="aspect-square">
              <ImageWithFallback
                src={image.imageUrl}
                alt={`검사 이미지 ${image.id}`}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Status Badge */}
            <div className="absolute top-2 right-2">
              {image.status === 'normal' ? (
                <div className="bg-[#00a63e] rounded-full p-1">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              ) : (
                <div className="bg-[#f54900] rounded-full p-1">
                  <XCircle className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>

      {/* Selected Image Details */}
      {selectedImage && (
        <div className="p-6 bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] rounded-lg border border-[#e5e7eb]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image Preview */}
            <div className="relative rounded-lg overflow-hidden bg-white border border-[#e5e7eb]">
              <ImageWithFallback
                src={selectedImage.imageUrl}
                alt="선택된 이미지"
                className="w-full h-full object-cover"
              />
              {selectedImage.status === 'defect' && selectedImage.defectType && (
                <div className="absolute top-4 left-4">
                  <div className="bg-[#f54900] text-white px-3 py-1 rounded-full text-[12px] font-bold">
                    {selectedImage.defectType}
                  </div>
                </div>
              )}
            </div>

            {/* Analysis Details */}
            <div className="space-y-4">
              <div>
                <h4 className="text-[#101828] text-[16px] font-bold mb-4">
                  분석 결과
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#e5e7eb]">
                    <span className="text-[#4a5565] text-[14px]">상태</span>
                    <div className="flex items-center gap-2">
                      {selectedImage.status === 'normal' ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-[#00a63e]" />
                          <span className="text-[#00a63e] text-[14px] font-bold">정상</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-[#f54900]" />
                          <span className="text-[#f54900] text-[14px] font-bold">결함</span>
                        </>
                      )}
                    </div>
                  </div>

                  {selectedImage.defectType && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#e5e7eb]">
                      <span className="text-[#4a5565] text-[14px]">결함 유형</span>
                      <span className="text-[#101828] text-[14px] font-bold">
                        {selectedImage.defectType}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#e5e7eb]">
                    <span className="text-[#4a5565] text-[14px]">신뢰도</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#155dfc] rounded-full"
                          style={{ width: `${selectedImage.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-[#101828] text-[14px] font-bold">
                        {selectedImage.confidence}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#e5e7eb]">
                    <span className="text-[#4a5565] text-[14px]">위치</span>
                    <span className="text-[#101828] text-[14px] font-medium">
                      {selectedImage.location}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#e5e7eb]">
                    <span className="text-[#4a5565] text-[14px]">검사 시간</span>
                    <span className="text-[#101828] text-[14px] font-medium">
                      {selectedImage.timestamp}
                    </span>
                  </div>
                </div>
              </div>

              {selectedImage.status === 'defect' && (
                <div className="p-4 bg-[#fff7ed] border border-[#fed7aa] rounded-lg">
                  <p className="text-[#92400e] text-[12px] font-medium">
                    <strong>조치 권장:</strong> 해당 차량을 재작업 라인으로 이동하여 결함 부위를 수정하시기 바랍니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
