import {CheckCircle2,Info,X} from 'lucide-react';
import {createContext,useCallback,useContext,useMemo,useState} from 'react';

type Toast={id:number;title:string;message?:string};
type ToastInput=Omit<Toast,'id'>;
type ToastContextValue={notify:(toast:ToastInput)=>void};

const ToastContext=createContext<ToastContextValue|null>(null);

export function ToastProvider({children}:{children:React.ReactNode}){
  const[toasts,setToasts]=useState<Toast[]>([]);
  const dismiss=useCallback((id:number)=>setToasts(current=>current.filter(toast=>toast.id!==id)),[]);
  const notify=useCallback((toast:ToastInput)=>{
    const id=Date.now()+Math.random();
    setToasts(current=>[...current.slice(-2),{...toast,id}]);
    window.setTimeout(()=>dismiss(id),5000);
  },[dismiss]);
  const value=useMemo(()=>({notify}),[notify]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite" aria-atomic="false">{toasts.map(toast=><article className="toast" key={toast.id}><span className="toast-icon"><CheckCircle2 size={19}/></span><div><strong>{toast.title}</strong>{toast.message&&<p>{toast.message}</p>}</div><button type="button" onClick={()=>dismiss(toast.id)} aria-label="Dismiss notification"><X size={17}/></button></article>)}</div></ToastContext.Provider>;
}

export function useToast(){const context=useContext(ToastContext);if(!context)throw new Error('useToast must be used inside ToastProvider');return context}

export function ConfirmDialog({open,title,message,confirmLabel='Confirm',busy=false,onConfirm,onCancel}:{open:boolean;title:string;message:string;confirmLabel?:string;busy?:boolean;onConfirm:()=>void;onCancel:()=>void}){
  if(!open)return null;
  return <div className="dialog-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onCancel()}}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"><span className="dialog-icon"><Info size={22}/></span><h2 id="confirm-title">{title}</h2><p id="confirm-message">{message}</p><div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="button" disabled={busy} autoFocus onClick={onConfirm}>{busy?'Updating…':confirmLabel}</button></div></section></div>;
}
