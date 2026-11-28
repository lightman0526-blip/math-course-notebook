const $=id=>document.getElementById(id);
const teacher=new URLSearchParams(location.search).has('teacher');
const incoming=new URLSearchParams(location.hash.slice(1)).get('family');
if(incoming){sessionStorage.setItem('juniorFamily',incoming);history.replaceState(null,'',location.pathname+location.search)}
const family=sessionStorage.getItem('juniorFamily');
let session=teacher?JSON.parse(sessionStorage.getItem('teacherSession')||'null'):null;
const el=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text});
function action(text,fn){
 const b=el('button',text);
 b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){$('notice').textContent=e.message}finally{b.disabled=false}};
 return b;
}
function login(){location.replace('./?teacher&course=junior')}
async function api(path,opts={}){
 const headers={apikey:APIKEY,...(teacher?{Authorization:'Bearer '+session?.access_token}:{'x-family-link':family||''}),...opts.headers};
 const res=await fetch(BASE+'/rest/v1/'+path,{...opts,headers});
 if(res.status===401&&teacher){login();throw Error('请重新登录。')}
 if(!res.ok){const e=Error('读取或保存失败，请重试。');e.status=res.status;throw e}
 if(opts.method==='POST')return;
 return res.json()
}
let doc=null,page=1,sequence=0;
async function paint(){
 const seq=++sequence, pdf=doc, index=page;
 const pg=await pdf.getPage(index),vp=pg.getViewport({scale:1.6});
 const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;
 await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
 if(seq!==sequence)return;
 $('paper').replaceChildren(c);$('paper').scrollTop=0;$('position').textContent=index+' / '+pdf.numPages;
 $('prev').disabled=index===1;$('next').disabled=index===pdf.numPages
}
$('prev').onclick=()=>{if(page>1){page--;paint().catch(report)}};
$('next').onclick=()=>{if(page<doc.numPages){page++;paint().catch(report)}};
$('close').onclick=()=>$('preview').close();
$('preview').onclose=()=>{sequence++;doc?.destroy();doc=null};
function report(e){$('notice').textContent=e.message}
async function openFile(file,save){
 const row=(await api('junior_materials?id=eq.'+encodeURIComponent(file.id)+'&select=pdf'))[0];
 if(!row)throw Error('这份资料暂时无法读取。');
 const bytes=Uint8Array.from(atob(row.pdf),x=>x.charCodeAt(0));
 if(save){
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const a=el('a','');a.href=url;a.download=file.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }else{
  const lib=await import('./pdfjs/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('pdfjs/pdf.worker.min.mjs',document.baseURI).href;
  doc=await lib.getDocument({data:bytes}).promise;page=1;$('caption').textContent=file.title;$('paper').replaceChildren();$('preview').showModal();await paint()
 }
}
function fileRow(file,container){
 const r=el('div','');r.className='file';const a=el('div','');a.className='actions';
 a.append(action('查看',()=>openFile(file,false)),action('下载',()=>openFile(file,true)));r.append(el('span',file.title),a);container.append(r)
}
async function load(){
 if(teacher&&!session){login();return}
 if(!teacher&&!family)throw Error('请使用老师提供的家庭专属链接。');
 const files=await api('junior_materials?select=id,section,title,filename&order=sort_order.asc');
 if(!files.length)throw Error('链接无效，请使用老师提供的家庭专属链接。');
 const groups=new Map();
 for(const f of files){if(!groups.has(f.section))groups.set(f.section,[]);groups.get(f.section).push(f)}
 const week=files[0].section;$('weekLabel').textContent=week;
 for(const [section,rows] of groups){
  let target=section===week?$('weekly'):section==='课程大纲'?$('outlines'):$('archive');
  if(target===$('archive'))target.append(el('h3',section));
  for(const f of rows)fileRow(f,target)
 }
 $('back').hidden=!teacher;$('submit').hidden=teacher;$('inbox').hidden=!teacher;$('materials').hidden=false;$('notice').textContent='';
}
$('inbox').ontoggle=async()=>{
 if(!teacher||!$('inbox').open)return;
 try{
  const rows=await api('junior_submissions?select=lesson_date,fingerprint&order=created_at.desc');
  $('photosList').replaceChildren();if(!rows.length)$('photosList').textContent='尚未收到作业照片。';
  for(const r of rows){
   const box=el('div','');box.append(action(r.lesson_date+' · 查看照片',async()=>{
    const data=await api('junior_submissions?select=photo&lesson_date=eq.'+r.lesson_date+'&fingerprint=eq.'+r.fingerprint);
    const img=el('img','');img.alt='作业照片';img.src='data:image/jpeg;base64,'+data[0].photo;box.replaceChildren(img)
   }));$('photosList').append(box)
  }
 }catch(e){report(e)}
};
$('day').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
document.querySelector('form').onsubmit=async e=>{
 e.preventDefault();const form=e.target,inputs=[...form.elements],date=$('day').value,batch=[...$('photos').files];
 inputs.forEach(x=>x.disabled=true);let done=0;
 try{
  for(const f of batch){
   if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024)throw Error('请选择 8 MB 以内的 JPG、PNG 或 WebP。');
   const hash=await crypto.subtle.digest('SHA-256',await f.arrayBuffer());
   const fingerprint=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
   const img=await createImageBitmap(f),scale=Math.min(1,2400/Math.max(img.width,img.height)),c=document.createElement('canvas');
   c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
   const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);img.close();
   const photo=c.toDataURL('image/jpeg',.82).split(',')[1];
   try{await api('junior_submissions',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({lesson_date:date,fingerprint,photo})})}catch(err){if(err.status!==409)throw err}
   $('receipt').textContent='已收到 '+(++done)+' / '+batch.length+' 张。'
  }
  $('photos').value=''
 }catch(err){$('receipt').textContent='已收到 '+done+' 张。'+err.message}finally{inputs.forEach(x=>x.disabled=false)}
};
load().catch(report);
