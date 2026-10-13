interface BackupWritable { write(data:Blob):Promise<void>; close():Promise<void>; abort():Promise<void>; }
interface BackupFileHandle { createWritable():Promise<BackupWritable>; }
type SavePickerWindow=Window & { showSaveFilePicker?:(options:object)=>Promise<BackupFileHandle> };
export const canChooseBackupLocation=()=>typeof (window as SavePickerWindow).showSaveFilePicker==='function' && window.isSecureContext===true;
/** Must be invoked directly by a click, not after a network request. */
export async function saveBackupFile(blob:Blob,name:string,assertCurrent:()=>void,chooseLocation=true):Promise<'saved'|'downloaded'|'cancelled'>{
 assertCurrent();
 if(chooseLocation && canChooseBackupLocation()){
  let handle:BackupFileHandle;
  try{handle=await (window as SavePickerWindow).showSaveFilePicker!({suggestedName:name,types:[{description:'پشتیبان مالی',accept:{'application/json':['.json']}}],excludeAcceptAllOption:true});}
  catch(e){if(e instanceof Error && e.name==='AbortError')return 'cancelled';throw new Error('انتخاب محل ذخیره در این محیط ممکن نیست؛ از گزینه دانلود عادی استفاده کنید.');}
  assertCurrent();const stream=await handle.createWritable();
  try{assertCurrent();await stream.write(blob);assertCurrent();await stream.close();return 'saved';}
  catch{await stream.abort().catch(()=>{});throw new Error('ذخیره فایل کامل نشد؛ دوباره تلاش کنید.');}
 }
 const url=URL.createObjectURL(blob);
 try{assertCurrent();const a=document.createElement('a');a.href=url;a.download=name;a.click();return 'downloaded';}
 finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
