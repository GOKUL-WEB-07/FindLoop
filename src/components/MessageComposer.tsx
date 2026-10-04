import {useEffect,useRef,useState} from 'react';
import {ImagePlus,Mic,Send,Square,X} from 'lucide-react';
import {useSendMessage} from '../hooks/useInteractions';
import type {MessageAttachment} from '../services/messages';
import type {Message} from '../types';

export function MessageMedia({message}:{message:Message}){
  if(!message.attachment_type)return null;
  if(!message.attachment_url)return <p>Attachment unavailable. Refresh to retry.</p>;
  return message.attachment_type==='photo'?<a href={message.attachment_url} target="_blank" rel="noreferrer"><img className="message-photo" src={message.attachment_url} alt="Shared photo" loading="lazy"/></a>:<audio controls preload="metadata" src={message.attachment_url} aria-label="Voice note"/>;
}

export function MessageComposer({listingId,peerId}:{listingId:string;peerId:string}){
  const send=useSendMessage();
  const[text,setText]=useState('');const[attachment,setAttachment]=useState<MessageAttachment>();
  const[preview,setPreview]=useState('');const[error,setError]=useState('');const[recording,setRecording]=useState(false);const[starting,setStarting]=useState(false);const[voiceFallback,setVoiceFallback]=useState(false);const[seconds,setSeconds]=useState(0);
  const input=useRef<HTMLInputElement>(null);const audioInput=useRef<HTMLInputElement>(null);const recorder=useRef<MediaRecorder|undefined>(undefined);const stream=useRef<MediaStream|undefined>(undefined);const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(recorder.current){recorder.current.onstop=null;if(recorder.current.state!=='inactive')recorder.current.stop();}stream.current?.getTracks().forEach(track=>track.stop());}},[]);
  useEffect(()=>{if(!attachment){setPreview('');return;}const url=URL.createObjectURL(attachment.file);setPreview(url);return()=>URL.revokeObjectURL(url)},[attachment]);
  useEffect(()=>{if(!recording)return;const timer=window.setInterval(()=>setSeconds(value=>value+1),1000);const limit=window.setTimeout(()=>stop(),120000);return()=>{clearInterval(timer);clearTimeout(limit)}},[recording]);
  function stop(){if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(track=>track.stop());setRecording(false);}
  function chooseVoice(file?:File){if(!file)return;setError('');const allowed=['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-m4a','audio/aac'];if(!allowed.includes(file.type)||!file.size||file.size>10*1024*1024){setError('Choose an audio recording up to 10 MB.');return;}setAttachment({file,type:'voice'});setVoiceFallback(false)}
  async function record(){
    setError('');
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setVoiceFallback(true);audioInput.current?.click();return;}
    setStarting(true);
    try{
      const media=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current){media.getTracks().forEach(track=>track.stop());return;}
      stream.current=media;
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(value=>MediaRecorder.isTypeSupported(value));
      if(!mime)throw new Error('Voice recording is not supported by this browser.');
      const current=new MediaRecorder(media,{mimeType:mime});recorder.current=current;const chunks:Blob[]=[];
      current.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};
      current.onstop=()=>{media.getTracks().forEach(track=>track.stop());if(!mounted.current)return;setRecording(false);const blob=new Blob(chunks,{type:mime});if(blob.size>10*1024*1024){setError('Recording is too large. Please record a shorter note.');return;}if(blob.size)setAttachment({type:'voice',file:new File([blob],'voice-note',{type:mime})})};
      current.onerror=()=>{stop();setError('Recording failed. Please try again.');};
      setSeconds(0);current.start();setRecording(true);
    }catch(cause){stream.current?.getTracks().forEach(track=>track.stop());if(mounted.current){setVoiceFallback(true);setError(cause instanceof DOMException&&cause.name==='NotAllowedError'?'Microphone access was denied. Allow it in your browser, or choose an audio recording below.':cause instanceof Error?cause.message:'Could not start recording.');}}
    finally{if(mounted.current)setStarting(false);}
  }
  return <div className="message-compose-area">
    {attachment&&<div className="attachment-preview">{attachment.type==='photo'?<img src={preview} alt="Photo ready to send"/>:<audio src={preview} controls aria-label="Preview voice note"/>}<button type="button" className="icon-button" disabled={send.isPending} onClick={()=>setAttachment(undefined)} aria-label="Remove attachment"><X size={18}/></button></div>}
    {recording&&<p className="recording-status" role="status">Recording · {seconds}s / 120s <button type="button" className="button secondary" onClick={stop}><Square size={16}/> Stop recording</button></p>}
    <form className="thread-composer" onSubmit={event=>{event.preventDefault();if(send.isPending||recording||starting||(!text.trim()&&!attachment))return;setError('');send.mutate({listingId,recipientId:peerId,body:text,attachment},{onSuccess:()=>{setText('');setAttachment(undefined)}})}}>
      <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setError('');if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){setError('Choose a JPG, PNG or WebP photo up to 10 MB.');return;}setAttachment({file,type:'photo'})}}/>
      <input ref={audioInput} hidden type="file" accept="audio/webm,audio/mp4,audio/ogg,audio/mpeg,audio/wav,audio/x-m4a,audio/aac" capture="user" onChange={event=>{const file=event.target.files?.[0];event.target.value='';chooseVoice(file)}}/>
      <button type="button" className="icon-button" aria-label="Attach photo" disabled={send.isPending||recording||starting} onClick={()=>input.current?.click()}><ImagePlus size={20}/></button>
      <button type="button" className="icon-button" aria-label="Record voice note" disabled={send.isPending||recording||starting||!!attachment} onClick={()=>void record()}><Mic size={20}/></button>
      <input aria-label="Message" value={text} disabled={send.isPending} onChange={event=>setText(event.target.value)} placeholder="Message…" maxLength={1500}/>
      <button className="button" aria-label={send.isPending?'Sending message':'Send message'} disabled={send.isPending||recording||starting||(!text.trim()&&!attachment)}><Send size={18}/></button>
    </form>
    {(starting||send.isPending)&&<p role="status">{starting?'Waiting for microphone…':'Sending…'}</p>}
    {(error||send.error)&&<p className="form-error" role="alert">{error||send.error?.message}</p>}
    {voiceFallback&&!attachment&&<p className="voice-fallback"><button type="button" className="button secondary" onClick={()=>audioInput.current?.click()}>Choose an audio recording</button></p>}
  </div>;
}
