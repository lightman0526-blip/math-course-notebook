"use strict";
let edition="student", drafts={}, weekNote=null,  debounceTimer=0, activeBuild=false, loadingWeek=false, saving=false;
const editions=["student","teacher"];
const editionLabel=id=>id==="student"?"学生版":"教师版";
function texEscape(s){
 const escaped={"\\":"\\textbackslash{}","{":"\\{","}":"\\}","%":"\\%","#":"\\#","&":"\\&","$":"\\$","_":"\\_","^":"\\textasciicircum{}","~":"\\textasciitilde{}"};
 return String(s||"").replace(/[\\{}%#&$_^~]/g,c=>escaped[c]).replace(/\n/g,"\\par\n");
}
function starter(id,week,old){
 const qs=(old.questions||[]).map((q,i)=>{
  const side=id==="student"?q.studentHint:[q.concept,q.steps,q.answer].filter(Boolean).join("\n");
  return "\\paragraph{题 "+(i+1)+"}\\noindent\n"+
   "\\begin{minipage}[t]{.58\\linewidth}"+texEscape(q.text)+"\\end{minipage}\\hfill\n"+
   "\\begin{minipage}[t]{.36\\linewidth}\\small\\textbf{"+(id==="student"?"一般性思路":"讲解与追问")+"}\\par "+texEscape(side)+"\\end{minipage}";
 }).join("\n\n");
 return [
  "\\documentclass[12pt,a4paper]{article}",
  "\\usepackage[margin=24mm]{geometry}",
  "\\usepackage{xeCJK,amsmath,amssymb,xcolor}",
  "\\setCJKmainfont{SimSun}[AutoFakeBold=true]",
  "\\begin{document}",
  "\\begin{center}{\\Large\\bfseries "+texEscape(old.title||"高一数学周讲义")+"}\\par "+week+"\\quad "+editionLabel(id)+"\\end{center}",
  "\\section*{第一部分\\quad 作业答疑}",
  qs || "% 在此录入本周题目及本版本的旁注。",
  "% end-weekly-questions",
  "\\clearpage",
  "\\section*{第二部分\\quad 知识梳理}",
  "% 按教材小节组织定义、命题与证明。练习与作业答疑沿用本版本的旁注格式。",
  "\\end{document}",""
 ].join("\n");
}
let pdfTask=null,pdfDoc=null,viewerRevision=0,paintRevision=0,pageNumber=1,zoom=1;
async function renderPage(){
 const paint=++paintRevision,doc=pdfDoc;
 if(!doc)return;
 const page=await doc.getPage(pageNumber);
 if(paint!==paintRevision)return;
 const area=$("pdfView"),base=page.getViewport({scale:1});
 const width=Math.max(200,area.clientWidth-30)*zoom;
 const ratio=Math.min(window.devicePixelRatio||1,2);
 const viewport=page.getViewport({scale:width/base.width*ratio});
 const canvas=node("canvas");
 canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 canvas.style.width=width+"px";canvas.style.height="auto";
 canvas.setAttribute("role","img");canvas.setAttribute("aria-label","第 "+pageNumber+" 页讲义");
 await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;
 if(paint!==paintRevision||doc!==pdfDoc)return;
 area.replaceChildren(canvas);area.scrollTop=0;
 $("pageCount").textContent=pageNumber+" / "+doc.numPages;
 $("prevPage").disabled=pageNumber===1;$("nextPage").disabled=pageNumber===doc.numPages;
 $("zoomOut").disabled=zoom<=.75;$("zoomIn").disabled=zoom>=2;
}
async function displayPdf(data,reset){
 const version=++viewerRevision;++paintRevision;
 if(reset){pageNumber=1;zoom=1}
 pdfDoc=null;
 if(pdfTask){pdfTask.destroy().catch(()=>{});pdfTask=null}
 $("pdfView").replaceChildren();$("pdfView").hidden=!data;$("pdfControls").hidden=!data;
 $("emptyPdf").hidden=!!data;$("emptyPdf").textContent="编译后在这里预览。";
 if(!data)return;
 try{
 const lib=await import("./pdfjs/pdf.min.mjs");
 if(version!==viewerRevision)return;
 lib.GlobalWorkerOptions.workerSrc=new URL("pdfjs/pdf.worker.min.mjs",document.baseURI).href;
 pdfTask=lib.getDocument({data:Uint8Array.from(atob(data),c=>c.charCodeAt(0)),isEvalSupported:false,useSystemFonts:true});
 const doc=await pdfTask.promise;if(version!==viewerRevision)return;
 pdfDoc=doc;pageNumber=Math.min(pageNumber,doc.numPages);await renderPage();
 }catch(e){if(version===viewerRevision){$("emptyPdf").hidden=false;$("emptyPdf").textContent="预览加载失败，可下载 PDF 阅读。";$("pdfView").hidden=true}}
}
for(const [key,delta] of [["prevPage",-1],["nextPage",1]])$(key).onclick=()=>{if(pdfDoc){pageNumber=Math.max(1,Math.min(pdfDoc.numPages,pageNumber+delta));renderPage().catch(e=>tell(e.message))}};
for(const [key,delta] of [["zoomOut",-.25],["zoomIn",.25]])$(key).onclick=()=>{zoom=Math.max(.75,Math.min(2,zoom+delta));renderPage().catch(e=>tell(e.message))};
let resizeTimer;
window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>renderPage().catch(e=>tell(e.message)),150)});
function pdfBlob(data){
 const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
 return new Blob([bytes],{type:"application/pdf"});
}
function download(blob,filename){
 const a=document.createElement("a"),url=URL.createObjectURL(blob);
 a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function unsaved(){return editions.some(id=>drafts[id]?.changed)||!!weekNote&&$("record").value!==(weekNote.body.record||"")}
function stateText(){
 const d=drafts[edition];
 if(!d)return;
 $("compileState").textContent=d.running?"正在编译":d.pdf?(d.source===d.compiled?"已编译 · 当前版本":"源码已改 · 预览为上次编译"):"尚未编译";
 $("compileError").textContent=d.error||"";$("compileError").hidden=!d.error;
 $("getPdf").disabled=!d.pdf;
 dirty=unsaved();
}
function showEdition(id){
 clearTimeout(debounceTimer);edition=id;
 for(const e of editions){const b=$(e==="student"?"editionStudent":"editionTeacher");b.setAttribute("aria-pressed",String(e===id))}
 const d=drafts[id];$("filename").textContent=id+".tex";$("texSource").value=d.source;
 displayPdf(d.pdf,true);
 stateText();
}
async function loadManuscript(){
 if(loadingWeek||activeBuild||saving)return;
 if(dirty&&!confirm("切换周次会丢弃未保存的修改，继续吗？"))return;
 clearTimeout(debounceTimer);loadingWeek=true;$("editor").inert=true;
 try{
 const wk=monday(document.querySelector("#lessons .week").value);
 const [week,s,t]=await Promise.all([readNote(wk),...editions.map(id=>readNote("tex-"+wk+"-"+id))]);
 const next={};[s,t].forEach((row,i)=>{const id=editions[i];next[id]={revision:row.revision,source:row.body.source??starter(id,wk,week.body),compiled:row.body.compiled||"",pdf:row.body.pdf||"",changed:false}});
 noteWeek=wk;weekNote=week;drafts=next;$("record").value=week.body.record||"";
 $("draft").hidden=false;showEdition(edition);$("intake").replaceChildren();
 document.querySelector("#intake").closest("details").open=false;
 document.querySelector("#intake").closest("details").ontoggle=async event=>{
  if(!event.target.open||$("intake").childElementCount)return;
  try{await loadPhotos(wk)}catch(e){tell(e.message)}
 };
 }finally{loadingWeek=false;$("editor").inert=false}
}
const photoViewer=$("photoViewer"),photoStage=$("photoStage");
let photoFiles=[],photoIndex=0,photoLoad=0;
async function openPhoto(files,index){
 if(index<0||index>=files.length)return;
 const load=++photoLoad;
 photoFiles=files;photoIndex=index;
 if(!photoViewer.open)photoViewer.showModal();
 $("photoPosition").textContent="照片 "+(index+1)+" / "+files.length;
 $("photoPrevious").disabled=index===0;
 $("photoNext").disabled=index===files.length-1;
 const notice=$("photoNotice");
 photoStage.replaceChildren(notice);
 photoStage.classList.remove("enlarged");photoStage.scrollTo(0,0);
 $("photoZoom").disabled=true;$("photoZoom").textContent="放大";
 notice.textContent="正在打开原图…";
 try{
  const url=await signed("course-photos","photos/"+noteWeek+"/"+files[index].name);
  if(load!==photoLoad||!photoViewer.open)return;
  const original=new Image();
  original.alt="作业原图 "+(index+1);original.src=url;
  await original.decode();
  if(load!==photoLoad||!photoViewer.open)return;
  notice.textContent="";photoStage.append(original);$("photoZoom").disabled=false;
 }catch(error){
  if(load!==photoLoad||!photoViewer.open)return;
  notice.textContent="原图未能加载。";
  notice.append(button("重试",()=>openPhoto(files,index)));
 }
}
$("photoPrevious").onclick=()=>openPhoto(photoFiles,photoIndex-1);
$("photoNext").onclick=()=>openPhoto(photoFiles,photoIndex+1);
$("photoZoom").onclick=()=>{
 const enlarged=photoStage.classList.toggle("enlarged");
 $("photoZoom").textContent=enlarged?"适应窗口":"放大";
};
$("photoClose").onclick=()=>photoViewer.close();
photoViewer.onclose=()=>{
 ++photoLoad;photoFiles=[];photoStage.replaceChildren($("photoNotice"));
};
photoViewer.onkeydown=event=>{
 if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
  event.preventDefault();openPhoto(photoFiles,photoIndex+(event.key==="ArrowRight"?1:-1));
 }
};
async function loadPhotos(wk){
 const files=[];for(let offset=0;;offset+=100){
  const batch=await request("/storage/v1/object/list/course-photos",{method:"POST",body:{prefix:"photos/"+wk,limit:100,offset,sortBy:{column:"created_at",order:"asc"}}});
  files.push(...batch);if(batch.length<100)break;
 }
 if(noteWeek!==wk)return;
 if(!files.length)$("intake").append(node("p","本周尚未收到照片。"));
 for(const [i,file] of files.entries()){
  const path="photos/"+wk+"/"+file.name,box=node("div");box.className="photo";
  const img=node("img");img.alt="作业照片 "+(i+1);img.loading="lazy";
  const preview=node("button");preview.type="button";preview.className="photoPreview";
  preview.setAttribute("aria-label","查看第 "+(i+1)+" 张原图");
  preview.append(img,node("span","查看原图"));preview.onclick=()=>openPhoto(files,i);
  box.append(preview,button("识别并插入当前稿",async()=>{
   const target=drafts[edition],url=await signed("course-photos",path);
   const worker=await Tesseract.createWorker("chi_sim+eng",1,{workerPath:new URL("ocr/worker.min.js",document.baseURI).href,corePath:new URL("ocr/tesseract-core-lstm.wasm.js",document.baseURI).href,langPath:new URL("ocr",document.baseURI).href,workerBlobURL:false});
   try{
    const {data}=await worker.recognize(url);
    if(noteWeek!==wk||target!==drafts[edition])throw Error("稿件已切换，请重新选择照片。");
    let marker="% end-weekly-questions",pos=target.source.indexOf(marker);
    if(pos<0 && target.source.includes("第二部分") && target.source.includes("知识梳理")){
     pos=target.source.indexOf("\\newgeometry{");
    }
    if(pos<0){marker="\\end{document}";pos=target.source.lastIndexOf(marker)}
    if(pos<0)throw Error("缺少 "+marker);
    target.source=target.source.slice(0,pos)+"\\par\n"+texEscape(data.text.trim())+"\n"+target.source.slice(pos);
    $("texSource").value=target.source;$("texSource").dispatchEvent(new Event("input"));tell("已插入识别文字，请核对公式。");
   }finally{await worker.terminate()}
  }));
  const url=await signed("course-photos",path);if(noteWeek!==wk)return;
  img.src=url;$("intake").append(box);
 }
}
function queueCompile(){
 clearTimeout(debounceTimer);
 if($("autoCompile").checked)debounceTimer=setTimeout(()=>compileManuscript(),1600);
}
async function compileManuscript(){
 if(activeBuild||loadingWeek||saving)return;
 clearTimeout(debounceTimer);
 const id=edition,d=drafts[id],source=d.source;
 activeBuild=true;d.running=true;d.error="";stateText();
 try{
  const r=await fetch("http://127.0.0.1:18779/compile",{method:"POST",headers:{"Content-Type":"text/plain; charset=utf-8",Authorization:"Bearer "+session.access_token},body:source,signal:AbortSignal.timeout(100000)});
  if(!r.ok)throw Error((await r.text())||"本机编译服务返回 "+r.status);
  const blob=await r.blob();
  const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(",")[1]);reader.onerror=reject;reader.readAsDataURL(blob)});
  d.pdf=encoded;d.compiled=source;d.changed=true;
  if(edition===id)displayPdf(d.pdf,false);
 }catch(e){d.error=e instanceof TypeError?"未连接本机编译器。请在教师电脑运行“启动编译.ps1”，并允许本站连接本地网络。":String(e.message||e)}
 finally{activeBuild=false;d.running=false;stateText();if(drafts[edition].source!==(edition===id?source:drafts[edition].compiled) && $("autoCompile").checked)queueCompile()}
}
bind("load",loadManuscript);
for(const id of editions)$(id==="student"?"editionStudent":"editionTeacher").onclick=()=>showEdition(id);
$("texSource").oninput=()=>{const d=drafts[edition];d.source=$("texSource").value;d.changed=true;d.error="";stateText();queueCompile()};
$("record").oninput=stateText;
$("autoCompile").onchange=()=>{clearTimeout(debounceTimer);if($("autoCompile").checked&&drafts[edition].source!==drafts[edition].compiled)queueCompile()};
bind("compile",compileManuscript);
bind("save",async()=>{
 if(activeBuild)throw Error("编译中，请稍后保存。");
 saving=true;$("draft").inert=true;clearTimeout(debounceTimer);
 try{
 for(const id of editions){const d=drafts[id];if(d.changed){
  d.revision=await writeNote("tex-"+noteWeek+"-"+id,d.revision,{source:d.source,compiled:d.compiled,pdf:d.pdf});d.changed=false;
 }}
 if($("record").value!==(weekNote.body.record||"")){
  const body={...weekNote.body,record:$("record").value};
  weekNote.revision=await writeNote(noteWeek,weekNote.revision,body);weekNote.body=body;
 }
 tell("本周修改已保存。");
 }finally{saving=false;$("draft").inert=false;stateText()}
});
bind("getTex",()=>download(new Blob([drafts[edition].source],{type:"text/plain;charset=utf-8"}),edition+".tex"));
bind("getPdf",()=>download(pdfBlob(drafts[edition].pdf),noteWeek+"-"+edition+".pdf"));




