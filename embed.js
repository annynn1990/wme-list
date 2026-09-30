(function(){
  var ROOT_ID='wme-list-embed';
  var LOCAL_KEY='wme-list-privy-edit-html';
  var PAGE_URL='https://annynn1990.github.io/wme-list/privy.html';
  var DATA_URL='https://annynn1990.github.io/wme-list/data.json?ts='+Date.now();
  var root=document.getElementById(ROOT_ID);
  if(!root)return;

  function addStyle(doc){
    var old=root.querySelector('style[data-wme-style]');
    if(old)old.remove();
    var style=document.createElement('style');
    style.setAttribute('data-wme-style','1');
    style.textContent=doc.querySelector('style')?doc.querySelector('style').textContent:'';
    document.head.appendChild(style);
  }

  function status(app,msg,state){
    var s=app.querySelector('#sync-status');
    if(s){s.textContent=msg;s.className=state;}
  }

  function saveLocal(tb,app){
    try{localStorage.setItem(LOCAL_KEY,tb.innerHTML);status(app,'正常連線','online');}catch(e){}
  }

  function restoreLocal(tb){
    try{var x=localStorage.getItem(LOCAL_KEY);if(x){tb.innerHTML=x;return true;}}catch(e){}
    return false;
  }

  function bindEditing(app,tb){
    app.classList.add('is-editing');
    tb.querySelectorAll('.name-field').forEach(function(el){
      if(!el.textContent.trim())el.textContent='懸缺';
    });
    app.querySelectorAll('.header h1,.header .subtitle,.wm-privy-table th,.wm-privy-table td.col-txt,.wm-privy-table .wm-p-rank,.wm-privy-table td:not(.col-txt) small,.sync > span:first-child').forEach(function(el){
      el.contentEditable='true';
      el.spellcheck=false;
      el.oninput=function(){saveLocal(tb,app);};
      el.onblur=function(){saveLocal(tb,app);};
    });
    app.querySelectorAll('.wm-portrait-box').forEach(function(box){
      box.onclick=function(){
        var url=prompt('輸入新肖像網址：');
        if(url){var img=document.createElement('img');img.src=url;img.className='wm-portrait-img';box.replaceChildren(img);saveLocal(tb,app);}
      };
    });
    status(app,'正常連線','online');
  }

  fetch(PAGE_URL,{cache:'no-store'})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})
    .then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html');
      addStyle(doc);
      var main=doc.querySelector('main');
      if(!main)throw new Error('main not found');
      root.innerHTML='';
      root.appendChild(main.cloneNode(true));
      var app=root.querySelector('#privy-app')||root.firstElementChild;
      var tb=root.querySelector('#table-body');
      var edit=root.querySelector('#edit-trigger');
      status(app,'讀取資料中','loading');

      var restored=restoreLocal(tb);
      var loadData=restored?Promise.resolve():fetch(DATA_URL,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(d){if(!d.savedHTML)throw new Error('資料格式錯誤');tb.innerHTML=d.savedHTML;});
      return loadData.then(function(){
        if(edit)edit.onclick=function(){
          if(prompt('管理員驗證：')==='1111')bindEditing(app,tb);
          else alert('驗證失敗。');
        };
        status(app,'正常連線','online');
      });
    })
    .catch(function(){
      root.innerHTML='<div style="padding:20px;color:#e74c3c;background:#fff;border:1px solid #a2a9b1">官職表讀取失敗</div>';
    });
})();