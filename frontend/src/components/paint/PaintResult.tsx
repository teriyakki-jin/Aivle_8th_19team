import React from "react";
import { usePaintStore } from "@/store/paintStore";

const PaintResult: React.FC = () => {
  const current = usePaintStore((s) => s.current);

  if (!current) return null;

  return (
    <div className="w-full h-full flex items-center justify-center">
      <img 
        src={current.img_result} 
        alt="result" 
        className="rounded-md border max-w-80 max-h-40 object-contain"
      />
    </div>
  );
};

export default PaintResult;