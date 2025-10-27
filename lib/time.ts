export const iso = (d: Date) => d.toISOString();
export const pad = (n:number)=>String(n).padStart(2,'0');
export const ymd = (d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
