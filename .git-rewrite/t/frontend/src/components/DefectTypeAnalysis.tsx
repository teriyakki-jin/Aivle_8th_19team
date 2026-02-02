import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export function DefectTypeAnalysis() {
  const data = [
    { name: '스크래치', value: 15, color: '#f54900' },
    { name: '먼지 오염', value: 12, color: '#9810fa' },
    { name: '색상 불균일', value: 8, color: '#155dfc' },
    { name: '기포', value: 3, color: '#00a63e' },
    { name: '기타', value: 2, color: '#62748e' },
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="bg-white rounded-[14px] border border-[#e5e7eb] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] p-6">
      <h3 className="text-[#101828] text-[18px] font-bold leading-[28px] mb-6">
        결함 유형 분석
      </h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pie Chart */}
        <div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Defect Type List */}
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-[#101828] text-[14px] font-medium">
                  {item.name}
                </span>
              </div>
              <div className="text-right">
                <p className="text-[#101828] text-[16px] font-bold">
                  {item.value}건
                </p>
                <p className="text-[#4a5565] text-[12px]">
                  {((item.value / total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-[#f8fafc] rounded-lg border border-[#e5e7eb]">
        <div className="flex items-center justify-between">
          <span className="text-[#4a5565] text-[14px]">전체 결함 수</span>
          <span className="text-[#101828] text-[18px] font-bold">{total}건</span>
        </div>
      </div>
    </div>
  );
}
