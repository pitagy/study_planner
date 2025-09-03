'use client';
export default function FocusFullscreen({
  open, onPause, onResume, onClose
}: { open:boolean; onPause:()=>void; onResume:()=>void; onClose:()=>void; }) {
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black text-yellow-300 flex flex-col items-center justify-center">
      <div className="text-[8vw] font-extrabold tracking-wider">FOCUS</div>
      <div className="mt-6 flex gap-3">
        <button className="px-5 py-3 rounded-xl bg-yellow-300 text-black font-bold" onClick={onPause}>일시정지</button>
        <button className="px-5 py-3 rounded-xl bg-yellow-300 text-black font-bold" onClick={onResume}>다시시작</button>
        <button className="px-5 py-3 rounded-xl border border-yellow-300 text-yellow-300 font-bold" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
