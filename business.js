(function(){
  const API="https://wme-list.vercel.app/api/businesses";
  const EDIT_PASSWORD="6666";
  const YEAR_NOW=new Date().getFullYear();

  const rows=document.getElementById("rows");
  const dbLight=document.getElementById("db-light");
  const loginMask=document.getElementById("login-mask");
  const loginInput=document.getElementById("login-input");
  const loginError=document.getElementById("login-error");
  const loginOk=document.getElementById("login-ok");
  const loginCancel=document.getElementById("login-cancel");
  const lock=document.getElementById("lock");
  const tools=document.getElementById("tools");
  const add=document.getElementById("add");
  const save=document.getElementById("save");
  const cancel=document.getElementById("cancel");

  let data={version:2,updatedAt:"",households:[]};
  let backup=null;
  let editing=false;
  let dragIndex=-1;

  function statusText(t,c){
    if(!dbLight)return;
    const offline=(c==="err");
    dbLight.classList.toggle("offline",offline);
    dbLight.title=offline?"資料庫讀取失敗":"資料庫連線正常";
    dbLight.setAttribute("aria-label",offline?"資料庫讀取失敗":"資料庫連線正常");
  }

  function esc(v){
    return String(v??"").replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function holdingText(v){
    const y=parseInt(v,10);
    if(!Number.isFinite(y)) return v?String(v):"";
    return y+"（"+Math.max(0,YEAR_NOW-y)+"年）";
  }

  function normalizeHousehold(h){
    if(!h.rentPaidYear && h.rentPaidYear !== 0) h.rentPaidYear="";
    if(!h.rentMissedSince && h.rentMissedSince !== 0) h.rentMissedSince="";
    if(!h.rentSupplementYear && h.rentSupplementYear !== 0) h.rentSupplementYear="";

    const validStates=["annualPaid","supplementPaid","awaitingSupplement","sealed","reclaimed"];

    if(!validStates.includes(h.rentState)){
      const paidYear=parseInt(h.rentPaidYear,10);
      const supplementYear=parseInt(h.rentSupplementYear,10);
      const missedYear=parseInt(h.rentMissedSince,10);

      if(Number.isFinite(supplementYear) && supplementYear===YEAR_NOW){
        h.rentState="supplementPaid";
        h.rentStateYear=supplementYear;
      }else if(Number.isFinite(paidYear) && paidYear===YEAR_NOW){
        h.rentState="annualPaid";
        h.rentStateYear=paidYear;
      }else if(Number.isFinite(missedYear)){
        h.rentState="awaitingSupplement";
        h.rentStateYear=missedYear;
      }else{
        // 新商戶或沒有舊狀態資料：預設為本年度正常繳租，年度租金可勾選。
        h.rentState="annualPaid";
        h.rentStateYear=YEAR_NOW;
      }
    }

    if(h.rentState==="annualPaid" && !Number.isFinite(parseInt(h.rentStateYear,10))){
      h.rentStateYear=YEAR_NOW;
    }

    let stateYear=parseInt(h.rentStateYear,10);

    if(h.rentState==="awaitingSupplement" && Number.isFinite(stateYear) && YEAR_NOW>stateYear+1){
      h.rentState="sealed";
      h.rentStateYear=YEAR_NOW;
      stateYear=YEAR_NOW;
    }

    if(h.rentState==="sealed" && Number.isFinite(stateYear) && YEAR_NOW>stateYear){
      h.rentState="reclaimed";
      h.rentStateYear=YEAR_NOW;
    }

    return h;
  }

  function statusState(h){
    normalizeHousehold(h);
    const stateYear=parseInt(h.rentStateYear,10);
    const current=(Number.isFinite(stateYear) && stateYear===YEAR_NOW);

    return {
      annual: h.rentState==="annualPaid" && current,
      supplement: h.rentState==="supplementPaid" && current,
      sealed: h.rentState==="sealed" && current,
      reclaimed: h.rentState==="reclaimed" && current,
      annualEditable: !["awaitingSupplement","sealed","reclaimed"].includes(h.rentState),
      supplementEditable:
        h.rentState==="awaitingSupplement" &&
        Number.isFinite(stateYear) &&
        YEAR_NOW===stateYear+1
    };
  }

  function box(checked, editable, i, action){
    return '<input type="checkbox" class="status-box '+(editable?"editable":"auto")+'" '+(checked?"checked":"")+
      (editable?' data-rent="'+i+'" data-rent-action="'+action+'"':' disabled')+' aria-label="狀態">';
  }

  function render(){
    if(!data.households.length){
      rows.innerHTML='<tr><td colspan="8" class="empty">目前沒有登錄商戶。</td></tr>';
      return;
    }

    if(!editing){
      rows.innerHTML=data.households.map(function(h,i){
        const s=statusState(h);
        return '<tr>'+
          '<td class="name">'+esc(h.name||"")+'</td>'+
          '<td>'+esc(h.address||"")+'</td>'+
          '<td>'+esc(h.registrant||"")+'</td>'+
          '<td class="year">'+esc(holdingText(h.year))+'</td>'+
          '<td class="status-cell">'+box(s.annual,false,i,"annual")+'</td>'+
          '<td class="status-cell">'+box(s.supplement,false,i,"supplement")+'</td>'+
          '<td class="status-cell">'+box(s.sealed,false,i,"sealed")+'</td>'+
          '<td class="status-cell">'+box(s.reclaimed,false,i,"reclaimed")+'</td>'+
          '</tr>';
      }).join("");
      return;
    }

    rows.innerHTML=data.households.map(function(h,i){
      const s=statusState(h);
      return '<tr class="editing">'+
        '<td><span class="drag-handle" draggable="true" data-drag="'+i+'" title="拖曳重新排序">☷</span><input class="text" data-i="'+i+'" data-k="name" value="'+esc(h.name||"")+'"></td>'+
        '<td><input class="text" data-i="'+i+'" data-k="address" value="'+esc(h.address||"")+'"></td>'+
        '<td><input class="text" data-i="'+i+'" data-k="registrant" value="'+esc(h.registrant||"")+'"></td>'+
        '<td class="year">'+
          '<input type="number" min="0" step="1" data-i="'+i+'" data-k="year" value="'+esc(h.year||"")+'">'+
          '<div class="small">目前 '+YEAR_NOW+' 年：'+esc(holdingText(h.year))+'</div>'+
          '<button type="button" class="del" data-del="'+i+'">刪除</button>'+
        '</td>'+
        '<td class="status-cell">'+box(s.annual,s.annualEditable,i,"annual")+'</td>'+
        '<td class="status-cell">'+box(s.supplement,s.supplementEditable,i,"supplement")+'</td>'+
        '<td class="status-cell">'+box(s.sealed,false,i,"sealed")+'</td>'+
        '<td class="status-cell">'+box(s.reclaimed,false,i,"reclaimed")+'</td>'+
        '</tr>';
    }).join("");
  }

  rows.addEventListener("input",function(e){
    const el=e.target;
    if(!el.matches("input[data-i]"))return;
    const i=Number(el.dataset.i);
    data.households[i][el.dataset.k]=el.value;
    if(el.dataset.k==="year"){
      const note=el.parentElement.querySelector(".small");
      if(note)note.textContent="目前 "+YEAR_NOW+" 年："+holdingText(el.value);
    }
  });

  rows.addEventListener("dragstart",function(e){
    const handle=e.target.closest("[data-drag]");
    if(!editing || !handle)return;
    dragIndex=Number(handle.dataset.drag);
    const tr=handle.closest("tr");
    if(tr){
      tr.classList.add("dragging");
      e.dataTransfer.effectAllowed="move";
      e.dataTransfer.setData("text/plain",String(dragIndex));
    }
  });

  rows.addEventListener("dragover",function(e){
    if(!editing || dragIndex<0)return;
    const tr=e.target.closest("tr.editing");
    if(!tr || tr.querySelector("[data-drag]")===null)return;
    e.preventDefault();
    rows.querySelectorAll("tr.drag-over").forEach(function(x){x.classList.remove("drag-over");});
    tr.classList.add("drag-over");
    e.dataTransfer.dropEffect="move";
  });

  rows.addEventListener("dragleave",function(e){
    const tr=e.target.closest("tr.editing");
    if(tr && !tr.contains(e.relatedTarget))tr.classList.remove("drag-over");
  });

  rows.addEventListener("drop",function(e){
    if(!editing || dragIndex<0)return;
    const target=e.target.closest("tr.editing");
    if(!target)return;
    e.preventDefault();

    const targetIndex=Array.prototype.indexOf.call(rows.children,target);
    if(targetIndex<0 || targetIndex===dragIndex)return resetDrag();

    const rect=target.getBoundingClientRect();
    const insertAfter=e.clientY > rect.top + rect.height/2;
    const item=data.households.splice(dragIndex,1)[0];

    let newIndex=targetIndex;
    if(dragIndex<targetIndex)newIndex--;
    if(insertAfter)newIndex++;
    newIndex=Math.max(0,Math.min(data.households.length,newIndex));

    data.households.splice(newIndex,0,item);
    resetDrag();
    render();
  });

  rows.addEventListener("dragend",function(){
    resetDrag();
  });

  function resetDrag(){
    rows.querySelectorAll("tr.dragging,tr.drag-over").forEach(function(tr){
      tr.classList.remove("dragging","drag-over");
    });
    dragIndex=-1;
  }

  rows.addEventListener("change",function(e){
    const rent=e.target.closest("[data-rent]");
    if(!rent || !editing)return;

    const i=Number(rent.dataset.rent);
    const h=data.households[i];
    const action=rent.dataset.rentAction;

    if(action==="annual"){
      if(rent.checked){
        h.rentPaidYear=YEAR_NOW;
        h.rentMissedSince="";
        h.rentSupplementYear="";
        h.rentState="annualPaid";
        h.rentStateYear=YEAR_NOW;
      }else{
        // 本年度未繳：下一年度只能進入「次年補繳」階段。
        h.rentPaidYear=YEAR_NOW-1;
        h.rentMissedSince=YEAR_NOW;
        h.rentSupplementYear="";
        h.rentState="awaitingSupplement";
        h.rentStateYear=YEAR_NOW;
      }
    }else if(action==="supplement"){
      if(rent.checked){
        h.rentSupplementYear=YEAR_NOW;
        h.rentState="supplementPaid";
        h.rentStateYear=YEAR_NOW;
      }else{
        h.rentSupplementYear="";
        h.rentState="awaitingSupplement";
        h.rentStateYear=YEAR_NOW-1;
      }
    }

    render();
  });

  rows.addEventListener("click",function(e){
    const btn=e.target.closest("[data-del]");
    if(!btn || !editing)return;
    const i=Number(btn.dataset.del);
    if(confirm("確定刪除此住宅？")){
      data.households.splice(i,1);
      render();
    }
  });

  function openLogin(){
    loginMask.classList.remove("off");
    loginInput.value="";
    loginError.textContent="";
    setTimeout(function(){loginInput.focus();},0);
  }

  function closeLogin(){
    loginMask.classList.add("off");
    loginInput.value="";
    loginError.textContent="";
  }

  function enterEdit(){
    backup=JSON.parse(JSON.stringify(data));
    editing=true;
    lock.textContent="🔓";
    tools.classList.remove("hidden");
    render();
    statusText("", "ok");
  }

  function exitEdit(){
    editing=false;
    lock.textContent="🔒";
    tools.classList.add("hidden");
    render();
  }

  loginOk.onclick=function(){
    if(loginInput.value!==EDIT_PASSWORD){
      loginError.textContent="密碼錯誤";
      loginInput.focus();
      return;
    }
    closeLogin();
    enterEdit();
  };

  loginCancel.onclick=closeLogin;

  loginInput.addEventListener("keydown",function(e){
    if(e.key==="Enter")loginOk.click();
    if(e.key==="Escape")closeLogin();
  });

  lock.onclick=function(){
    if(editing){
      exitEdit();
      statusText("", "ok");
    }else{
      openLogin();
    }
  };

  cancel.onclick=function(){
    if(backup)data=JSON.parse(JSON.stringify(backup));
    exitEdit();
    statusText("", "ok");
  };

  add.onclick=function(){
    data.households.push({
      id:Date.now(),
      name:"",
      address:"",
      registrant:"",
      year:"",
      rentPaidYear:"",
      rentMissedSince:"",
      rentSupplementYear:"",
      rentState:"annualPaid",
      rentStateYear:YEAR_NOW
    });
    render();
    const inputs=rows.querySelectorAll("input.text,input[type=number]");
    if(inputs.length)inputs[0].focus();
  };

  save.onclick=async function(){
    save.disabled=true;
    statusText("", "ok");
    try{
      const r=await fetch(API,{
        method:"PUT",
        headers:{
          "Content-Type":"application/json",
          "X-Edit-Password":EDIT_PASSWORD
        },
        body:JSON.stringify(data)
      });
      const out=await r.json();
      if(!r.ok)throw new Error(out.error||("HTTP "+r.status));
      data=out;
      exitEdit();
      statusText("", "ok");
    }catch(e){
      statusText("", "err");
    }finally{
      save.disabled=false;
    }
  };

  async function load(){
    statusText("", "ok");
    try{
      const r=await fetch(API,{cache:"no-store"});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const out=await r.json();
      data=out&&Array.isArray(out.households)?out:{version:2,households:[]};
      data.households.forEach(normalizeHousehold);
      data.households.sort(function(a,b){
        const ay=parseInt(a.year,10);
        const by=parseInt(b.year,10);
        const av=Number.isFinite(ay)?ay:-Infinity;
        const bv=Number.isFinite(by)?by:-Infinity;
        return av-bv;
      });
      render();
      statusText("", "ok");
    }catch(e){
      rows.innerHTML='<tr><td colspan="8" class="empty">讀取失敗：'+esc(e.message)+'</td></tr>';
      statusText("", "err");
    }
  }

  load();
})();