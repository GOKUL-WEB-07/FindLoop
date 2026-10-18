// Date-only database values represent a calendar day, not a UTC instant.
export function localDate(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
export function calendarDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+'T00:00:00'):new Date(value);}
