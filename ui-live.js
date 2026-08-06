(()=>{
'use strict';

let timer=0;

function compact(n){
  if(!Number.isFinite(Number(n))) return '0';
  n=Number(n);
  const abs=Math.abs(n);
  const units=[[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'K']];
  for(const [v,s] of units){
    if(abs>=v){
      const d=abs>=v*100?0:abs>=v*10?1:2;
      return (n/v).toFixed(d).replace(/\.0+$/,'')+s;
    }
  }
  return Math.floor(n).toLocaleString('zh-CN');
}

function taskRow(icon,name,current,target,reward,done){
  const pct=Math.max(0,Math.min(100,current/target*100));
  return `<div class="task-live-row ${done?'done':''}">
    <span class="task-icon">${icon}</span>
    <span class="task-copy"><b>${name}</b><small>${compact(current)} / ${compact(target)}</small><i><em style="width:${pct}%"></em></i></span>
    <span class="task-reward">${done?'✓':reward}</span>
  </div>`;
}

function render(){
  const api=window.RecycleRush;
  if(!api) return;
  const s=api.state();
  if(!s) return;

  const tasks=[
    ['♻️','回收塑料',s.tasks?.plastic||0,5000,'50M',s.taskClaims?.plastic],
    ['📄','压缩纸张',s.tasks?.paper||0,2500,'40M',s.taskClaims?.paper],
    ['📦','打包成品',s.tasks?.box||0,2000,'30M',s.taskClaims?.box],
    ['📍','解锁区域',s.factoryLevel>=9?1:0,1,'500',s.taskClaims?.factory]
  ];

  const task=document.getElementById('taskLiveBody');
  if(task) task.innerHTML=tasks.map(x=>taskRow(...x)).join('');

  const completed=tasks.filter(x=>x[2]>=x[3]).length;
  const mini=document.getElementById('taskMiniText');
  if(mini) mini.textContent=`${completed} / ${tasks.length} 项可完成`;

  const product=document.getElementById('productLiveBody');
  if(product){
    const levels=s.stations||[0,0,0,0,0,0];
    const items=[
      ['🧴','再生塑料',levels[1]*80000],
      ['📄','再生纸浆',levels[2]*70000],
      ['📦','再生纸板',levels[3]*65000]
    ];
    product.innerHTML=items.map(x=>`<div class="product-live-item compact"><span>${x[0]}</span><b>${x[1]}</b><small>${compact(x[2])}/秒</small></div>`).join('');
  }
}

function start(){
  if(timer) return;
  const taskPanel=document.getElementById('taskLive');
  if(taskPanel){
    taskPanel.addEventListener('click',()=>document.querySelector('[data-action="tasks"]')?.click());
  }
  render();
  timer=window.setInterval(render,300);
}

window.RecycleRushUI={start,render};
})();
