"use strict";
const BASE="https://nuuhhiivnexisrfutchg.supabase.co";
const APIKEY="sb_publishable_2XezXb0h03fapKVeqZxl1w_Vp5VjZ6f";
const $=id=>document.getElementById(id);
const node=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text||""});
const tell=t=>$("status").textContent=t;
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has("submit")){
  sessionStorage.setItem("familyLink",fragment.get("submit"));
  history.replaceState(null,"",location.pathname+location.search);
}
let session=JSON.parse(sessionStorage.getItem("teacherSession")||"null");
let teacher=false, current="upload", noteWeek="", revision=0, progressRev=0, dirty=false;
let topics=["预备知识","集合、逻辑与不等式","函数","指数函数、对数函数、幂函数","三角函数","平面向量","三角恒等变换","解三角形"];
const books={b1:"必修 第一册",b2:"必修 第二册",b3:"必修 第三册",b4:"必修 第四册",s3:"选择性必修 第三册"};
function monday(value){
 const d=new Date(value+"T12:00:00"); if(!Number.isFinite(+d))throw Error("请选择上课日期");
 d.setDate(d.getDate()-(d.getDay()+6)%7);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}
const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Shanghai"}).format(new Date());
for(const input of document.querySelectorAll(".week")){
 input.value=today;
 const label=input.closest("label").nextElementSibling;
 const update=()=>label.textContent=input.value?"归入 "+monday(input.value)+" 开始的一周":"请选择上课日期";
 input.onchange=update;update();
}
async function request(path,{method="GET",body,raw,anon=false,headers={}}={}){
 const h={apikey:APIKEY,...headers};
 if(!anon && session)h.Authorization="Bearer "+session.access_token;
 if(body!==undefined)h["Content-Type"]="application/json";
 const r=await fetch(BASE+path,{method,headers:h,body:raw||JSON.stringify(body)});
 const txt=await r.text();let data;
 try{data=JSON.parse(txt)}catch{data=txt}
 if(!r.ok)throw Object.assign(Error(data?.msg||data?.message||data?.error_description||"请求失败，请重试"),{status:r.status,code:data?.error});
 return data;
}
const button=(label,fn)=>{const b=node("button",label);b.onclick=()=>run(b,fn);return b};
async function run(b,fn){b.disabled=true;tell("");try{await fn()}catch(e){tell(e.message)}finally{b.disabled=false}}
function bind(id,fn){$(id).onclick=()=>run($(id),fn)}
function page(id){
 current=id;
 for(const el of document.querySelectorAll("main>section"))el.hidden=el.id!==id;
 for(const b of document.querySelectorAll("nav button"))b.classList.toggle("active",b.dataset.page===id);
 $("auth").hidden=id==="upload";$("editor").hidden=!teacher;
 $("loginForm").hidden=teacher;$("logout").hidden=!teacher;
 tell("");
}
for(const b of document.querySelectorAll("nav button"))b.onclick=()=>page(b.dataset.page);
async function preparationImage(file){
 const bitmap=await createImageBitmap(file);
 try{
  const canvas=document.createElement("canvas");
  const ratio=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
  canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [.87,.72,.55,.38]){
   const data=canvas.toDataURL("image/jpeg",quality).split(",")[1];
   if(data.length<=2000000)return data;
  }
  throw Error("请裁切题目后重试");
 }finally{bitmap.close()}
}
const family=()=>sessionStorage.getItem("familyLink");
const pending=[];
let uploading=false;
let selectedWeek="";
const familyDate=document.querySelector("#upload .week");
const allowedPhotos={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
function drawQueue(){
 const list=$("photoQueue");
 list.replaceChildren();
 for(const item of pending){
  const li=node("li");
  li.append(node("span",item.file.name),node("small",item.status));
  if(!uploading && !item.sent){
   li.append(button("移除",()=>{
    pending.splice(pending.indexOf(item),1);
    if(!pending.length)selectedWeek="";
    drawQueue();
   }));
  }
  list.append(li);
 }
 const unsent=pending.filter(item=>!item.sent).length;
 $("fileChoice").textContent=pending.length?"已选择 "+pending.length+" 张 · 可继续追加":"可连续追加多批 · JPG、PNG、WebP · 每张最多 8 MB";
 $("send").textContent=uploading?"正在上传…":unsent?"上传待提交的 "+unsent+" 张照片":"批量上传";
 $("send").disabled=!family()||uploading||unsent===0;
 $("images").disabled=uploading;
 $("clearQueue").hidden=!pending.length;
 $("clearQueue").disabled=uploading;
 familyDate.disabled=uploading||!!selectedWeek;
}
$("images").addEventListener("change",()=>{
 for(const file of $("images").files)pending.push({file,status:"待上传",sent:false});
 $("images").value="";
 if(family())$("receipt").textContent="";
 drawQueue();
});
$("clearQueue").onclick=()=>{
 pending.length=0;selectedWeek="";drawQueue();
 if(family())$("receipt").textContent="";
};
async function sendPhoto(file,week){
 const ext=allowedPhotos[file.type];
 if(!ext||!file.size||file.size>8388608)throw Error("请选择 8 MB 以内的 JPG、PNG 或 WebP");
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),n=>n.toString(16).padStart(2,"0")).join("");
 const preview=await preparationImage(file);
 try{
  await request("/storage/v1/object/course-photos/photos/"+week+"/"+family()+"_"+hash+"."+ext,{method:"POST",raw:file,headers:{"Content-Type":file.type},anon:true});
 }catch(e){if(e.code!=="Duplicate" && e.status!==409 && !/already exists/i.test(e.message))throw e}
 try{
  await request("/rest/v1/prep_images",{method:"POST",anon:true,headers:{"x-family-link":family(),Prefer:"return=minimal"},body:{week,fingerprint:hash,preview}});
 }catch(e){if(e.status!==409)throw Error("原图已收，备课图待同步，请重试")}
}
$("send").onclick=async()=>{
 if(uploading||!family()||!pending.some(item=>!item.sent))return;
 if(!familyDate.value){tell("请选择上课日期");return}
 selectedWeek=selectedWeek||monday(familyDate.value);
 uploading=true;tell("");drawQueue();
 try{
  for(const item of pending.filter(photo=>!photo.sent)){
   item.status="上传中";drawQueue();
   try{await sendPhoto(item.file,selectedWeek);item.sent=true;item.status="已收到"}
   catch(e){item.status="待处理 · "+e.message}
   $("receipt").textContent="已收到 "+pending.filter(photo=>photo.sent).length+" / "+pending.length+" 张。";
  }
 }finally{
  uploading=false;drawQueue();
  $("receipt").textContent+=pending.some(item=>!item.sent)?" 请检查待处理项后再次上传。":" 已归入 "+selectedWeek+" 开始的一周。";
 }
};
$("receipt").textContent=family()?"":"请使用老师提供的家庭专属链接交题。";
drawQueue();
$("loginForm").onsubmit=event=>{
 event.preventDefault();
 const submit=$("passwordLogin");
 if(submit.disabled)return;
 run(submit,async()=>{
  const username=$("username").value.trim().toLowerCase();
  if(!/^[a-z0-9._-]+$/.test(username))throw Error("请输入教师账号。");
  try{
   session=await request("/auth/v1/token?grant_type=password",{method:"POST",anon:true,body:{
    email:username+"@mails.tsinghua.edu.cn",password:$("password").value
   }});
  }catch(error){
   if(error.status===400)throw Error("账号或密码有误，请重新输入。");
   if(error.status===429)throw Error("登录尝试过于频繁，请稍后再试。");
   throw error;
  }
  $("password").value="";
  await checkTeacher();
 });
};
async function checkTeacher(){
 const role=await request("/rest/v1/rpc/course_role",{method:"POST",body:{}});
 if(role!=="teacher"){session=null;sessionStorage.removeItem("teacherSession");throw Error("该账号没有教师权限")}
 teacher=true;sessionStorage.setItem("teacherSession",JSON.stringify(session));page(current==="upload"?"lessons":current);await drawBooks();if(current==="lessons")await loadManuscript();
}
bind("logout",async()=>{await request("/auth/v1/logout",{method:"POST"});sessionStorage.removeItem("teacherSession");location.reload()});
async function readNote(id){return (await request("/rest/v1/course_notes?id=eq."+id))[0]||{body:{},revision:0}}
async function writeNote(id,rev,body){
 const rows=await request("/rest/v1/course_notes"+(rev?"?id=eq."+id+"&revision=eq."+rev:""),{method:rev?"PATCH":"POST",body:{id,revision:rev+1,body},headers:{Prefer:"return=representation"}});
 if(rows.length!==1)throw Error("其他窗口已修改这份资料，请保留当前文字并重新读取");return rev+1;
}
async function signed(bucket,path){
 const d=await request("/storage/v1/object/sign/"+bucket+"/"+path,{method:"POST",body:{expiresIn:600}});
 return BASE+"/storage/v1"+d.signedURL;
}
async function drawBooks(){
 const p=teacher?await readNote("progress"):{body:{},revision:0};progressRev=p.revision;
 $("topics").replaceChildren();const states=[];
 for(const [i,t] of topics.entries()){
  const row=node("div");row.className="row";row.append(node("span",t));
  if(teacher){const select=node("select");select.setAttribute("aria-label",t+"进度");
   for(const s of ["待确认","已讲","正在学","待学"]){select.add(new Option(s,s))}
   select.value=p.body[i]||(["待确认","待确认","待确认","已讲","正在学"][i]||"待学");row.append(select);states.push(select)}
  $("topics").append(row);
 }
 if(teacher)$("topics").append(button("保存教学进度",async()=>{progressRev=await writeNote("progress",progressRev,states.map(x=>x.value));tell("教学进度已保存")}));
 $("library").replaceChildren();
 for(const [key,name] of Object.entries(books)){const card=node("div");card.className="card";card.append(node("small","普通高中教科书"),node("h2",name));
 if(teacher)card.append(button("阅读教材",async()=>{const a=node("a","打开 PDF（10 分钟内有效）");a.href=await signed("course-files","books/14702fcb6c444b10b6c1036d9368f814/"+key+".pdf");a.target="_blank";a.rel="noreferrer";card.append(a);a.click()}));
 $("library").append(card)}
}
window.onbeforeunload=e=>{if(dirty){e.preventDefault();e.returnValue=""}};
(async()=>{
 if(fragment.has("access_token")||fragment.has("error"))history.replaceState(null,"",location.pathname+location.search);
 page(new URLSearchParams(location.search).has("teacher")?"lessons":"upload");await drawBooks();
 if(session){try{if(session.refresh_token)session=await request("/auth/v1/token?grant_type=refresh_token",{method:"POST",anon:true,body:{refresh_token:session.refresh_token}});await checkTeacher()}catch(e){session=null;sessionStorage.removeItem("teacherSession");page("lessons");tell("请重新登录教师账号。")}}
})().catch(e=>tell(e.message));




function drawFunctionChart(){
 const c=$("curves").getContext("2d");
 const X=x=>180+82*x, Y=y=>360-82*y;
 function line(points,color,width){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(X(x),Y(y)):c.moveTo(X(x),Y(y)));
  c.strokeStyle=color;c.lineWidth=width;c.stroke();
 }
 for(let i=-2;i<=7;i++){line([[i,-2],[i,5]],"#ffffff1b",1);line([[-3,i],[7,i]],"#ffffff1b",1)}
 line([[-3,0],[7,0]],"#bfd3f0",2);line([[0,-2],[0,5]],"#bfd3f0",2);
 c.setLineDash([7,9]);line([[-2,-2],[5,5]],"#b1c8ee99",2);c.setLineDash([]);
 const exp=[],log=[];for(let i=-200;i<=340;i++){const x=i/50;exp.push([x,2**x]);if(x>0)log.push([x,Math.log2(x)])}
 line(exp,"#ffffff",4);line(log,"#98bfff",4);
 c.font="italic 32px Georgia";c.fillStyle="white";c.fillText("y = 2ˣ",X(.12),Y(3.3));
 c.fillStyle="#c0d8ff";c.fillText("y = log₂ x",X(3.7),Y(1.3));
}
drawFunctionChart();





