import {useState} from 'react';
import {useInstall} from '../lib/install';
import {ArrowLeft,Download,Smartphone} from 'lucide-react';
import {Link} from 'react-router-dom';

function apkDownloadUrl():string|null{
  const value=import.meta.env.VITE_APK_DOWNLOAD_URL?.trim();
  if(!value)return null;
  try{
    const url=new URL(value,window.location.origin);
    return url.protocol==='https:'||(url.protocol==='http:'&&url.origin===window.location.origin)?url.href:null;
  }catch{return null}
}

export function DownloadPage(){
  const url=apkDownloadUrl();
  const {state,install}=useInstall();
  const [error,setError]=useState('');
  return <div className="auth apk-page">
    <Link className="brand" to="/"><span>FL</span> FindLoop</Link>
    <section className="auth-card" aria-labelledby="apk-title">
      <Smartphone size={36} aria-hidden="true"/>
      <p className="eyebrow">INSTALL FINDLOOP</p>
      <h1 id="apk-title">Your campus, on the go.</h1>
      <p>Add FindLoop to your home screen or desktop directly from your browser.</p>
      {state==='installed'?<p role="status">FindLoop is installed on this device.</p>:state==='ready'?<button className="button apk-download" onClick={async()=>{setError('');try{await install()}catch{setError('The install prompt could not open. Use your browser menu to install FindLoop.')}}}><Download size={18} aria-hidden="true"/>Install FindLoop</button>:<div className="apk-note"><p>On Android or desktop, open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, if available.</p><p>On iPhone or iPad, open this site in Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p></div>}
      {error&&<p role="alert" className="form-error">{error}</p>}
      <p className="apk-note">An internet connection is needed for listings and messages.</p>
      {url?<>
        <a className="button apk-download" href={url} download="FindLoop.apk"><Download size={18} aria-hidden="true"/>Download APK</a>
        <p className="apk-note">Android only. Once downloaded, open the APK on your phone and follow the installation prompts. Your phone may ask you to allow installation from your browser.</p>
      </>:<>
        <button className="button apk-download" disabled><Download size={18} aria-hidden="true"/>APK coming soon</button>
        <p className="apk-note">The Android download isn’t available yet. You can continue using FindLoop in your browser.</p>
      </>}
      <Link className="back" to="/"><ArrowLeft size={16} aria-hidden="true"/>Continue in browser</Link>
    </section>
  </div>;
}
