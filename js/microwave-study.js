/* Microwave teaching models: lossless lines, shorted shunt stub and ideal TE10. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg', TAU=2*Math.PI;
  const colors={blue:'var(--mw-blue)',green:'var(--mw-accent)',orange:'var(--mw-orange)',line:'var(--mw-line)',ink:'var(--mw-ink)'};
  const mk=(tag,attrs={},text='')=>{const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n;};
  const sv=(tag,attrs={},text='')=>{const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n;};
  const cx=(r,i=0)=>({r,i});
  const add=(a,b)=>cx(a.r+b.r,a.i+b.i);
  const sub=(a,b)=>cx(a.r-b.r,a.i-b.i);
  const div=(a,b)=>{const q=b.r*b.r+b.i*b.i;return cx((a.r*b.r+a.i*b.i)/q,(a.i*b.r-a.r*b.i)/q);};
  const abs=a=>Math.hypot(a.r,a.i);
  const fmt=(a,n=3)=>`${Math.abs(a.r)<1e-10?Number(0).toFixed(n):a.r.toFixed(n)} ${a.i<0?'−':'+'} j${Math.abs(a.i).toFixed(n)}`;
  const samples=(a,b,n,fn)=>Array.from({length:n},(_,i)=>{const x=a+(b-a)*i/(n-1);return [x,fn(x)];});
  const mod=(a,b)=>((a%b)+b)%b;
  let nextId=0;
  function chart(host,title,xlim,ylim,xlabel,ylabel,xt,yt,square=false){
    const w=Math.max(230,Math.floor(host.getBoundingClientRect().width));
    const h=square?Math.min(w+12,380):(w<400?242:270);
    const m={l:43,r:19,t:27,b:43};let pw=w-m.l-m.r,ph=h-m.t-m.b;
    if(square){const side=Math.min(pw,ph);m.l+=(pw-side)/2;pw=side;ph=side;}
    const X=x=>m.l+(x-xlim[0])/(xlim[1]-xlim[0])*pw;
    const Y=y=>m.t+ph-(y-ylim[0])/(ylim[1]-ylim[0])*ph;
    const svg=sv('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':title});svg.append(sv('title',{},title));
    const line=(x1,y1,x2,y2,color=colors.line,dash='')=>{const a=sv('line',{x1:X(x1),y1:Y(y1),x2:X(x2),y2:Y(y2),stroke:color,'stroke-width':1});if(dash)a.setAttribute('stroke-dasharray',dash);svg.append(a);return a;};
    xt.forEach(t=>{line(t,ylim[0],t,ylim[1]);svg.append(sv('text',{x:X(t),y:m.t+ph+19,'text-anchor':'middle'},String(t)));});
    yt.forEach(t=>{line(xlim[0],t,xlim[1],t);svg.append(sv('text',{x:m.l-8,y:Y(t)+4,'text-anchor':'end'},String(t)));});
    if(ylim[0]<=0&&ylim[1]>=0)line(xlim[0],0,xlim[1],0,colors.line);
    svg.append(sv('text',{x:m.l,y:15},ylabel));svg.append(sv('text',{x:m.l+pw,y:h-3,'text-anchor':'end'},xlabel));
    const path=(points,color,width=2.3,dash='')=>{const p=sv('path',{d:points.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-linejoin':'round'});if(dash)p.setAttribute('stroke-dasharray',dash);svg.append(p);return p;};
    const dot=(x,y,color)=>svg.append(sv('circle',{cx:X(x),cy:Y(y),r:4,fill:color}));
    host.replaceChildren(svg);return {line,path,dot,svg};
  }
  function control(host,label,min,max,step,value,format){
    const box=mk('div',{class:'mw-control'}),top=mk('div',{class:'mw-control-top'}),id=`mw-control-${++nextId}`;
    const input=mk('input',{id,type:'range',min,max,step,value});const output=mk('output',{for:id});
    top.append(mk('label',{for:id},label),output);box.append(top,input);host.append(box);
    const sync=()=>{output.value=format(Number(input.value));input.setAttribute('aria-valuetext',output.value);};sync();
    input.addEventListener('input',sync);return {input,output,get:()=>Number(input.value),set:v=>{input.value=v;sync();}};
  }
  const button=(host,text,fn)=>{const b=mk('button',{type:'button'},text);b.addEventListener('click',fn);host.append(b);return b;};
  function legend(host,items){const d=mk('div',{class:'mw-demo-legend'});items.forEach(([t,c])=>{const s=mk('span'),i=mk('i');i.style.background=c;s.append(i,document.createTextNode(t));d.append(s);});host.append(d);}
  function init(root){
    if(!['standing-wave','smith','waveguide'].includes(root.dataset.mwDemo))return;
    if(root.dataset.ready)return;root.dataset.ready='true';const kind=root.dataset.mwDemo;
    const title=mk('strong',{class:'mw-demo-title'}),controls=mk('div',{class:'mw-demo-controls'}),actions=mk('div',{class:'mw-demo-actions'}),plot=mk('div',{class:'mw-demo-plot'}),readout=mk('p',{class:'mw-demo-readout','aria-live':'polite','aria-atomic':'true'}),note=mk('p',{class:'mw-demo-note'});
    root.replaceChildren(title,controls,actions,plot);let draw;
    if(kind==='standing-wave'){
      title.textContent='拖动看：瞬时电压在动，驻波包络不随时间移动';
      const r=control(controls,'反射系数的模 |ΓL|',0,1,.01,.6,v=>v.toFixed(2));
      const phi=control(controls,'负载反射相位 φL',-180,180,1,180,v=>`${v}°`);
      const t=control(controls,'观察时刻 t/T',0,1,.01,0,v=>v.toFixed(2));
      legend(root,[['瞬时电压',colors.blue],['幅度包络 ±|V|',colors.orange],['首个波节位置',colors.green]]);
      note.textContent='固定入射峰值 |V+|=1。d 从负载向源增加；包络由复相量的模给出，不是某一时刻的电压曲线。改变观察时刻，包络和平均净功率都不变。';
      draw=()=>{
        const g=r.get(),p=phi.get()*Math.PI/180,time=t.get();
        const ch=chart(plot,'传输线瞬时电压与驻波包络',[0,1],[-2.15,2.15],'d / λ  → 源','v / |V+|',[0,.25,.5,.75,1],[-2,-1,0,1,2]);
        const env=x=>Math.sqrt(Math.max(0,1+g*g+2*g*Math.cos(p-2*TAU*x)));
        ch.path(samples(0,1,301,env),colors.orange,2,'6 4');ch.path(samples(0,1,301,x=>-env(x)),colors.orange,2,'6 4');
        ch.path(samples(0,1,401,x=>Math.cos(TAU*(time+x))+g*Math.cos(TAU*(time-x)+p)),colors.blue);
        const dmin=mod((p-Math.PI)/(2*TAU),.5);
        if(g>0){ch.line(dmin,-2.1,dmin,2.1,colors.green,'4 4');ch.dot(dmin,env(dmin),colors.green);}
        const rho=g===1?'∞':((1+g)/(1-g)).toFixed(2);
        readout.textContent=`驻波比 ρ=${rho}；包络 ${(1-g).toFixed(2)}–${(1+g).toFixed(2)}；P净 / P入 = ${(1-g*g).toFixed(3)}；首波节 d/λ = ${g>0?dmin.toFixed(3):'无唯一位置（匹配线）'}。`;
      };
      button(actions,'匹配负载',()=>{r.set(0);draw();});button(actions,'开路',()=>{r.set(1);phi.set(0);draw();});button(actions,'短路',()=>{r.set(1);phi.set(180);draw();});button(actions,'复位',()=>{r.set(.6);phi.set(180);t.set(0);draw();});
    } else if(kind==='smith'){
      title.textContent='拖动看：先沿线旋转，再用短路支节消去电纳';
      const d=control(controls,'主线距离 d/λ',0,.5,.001,.1,v=>v.toFixed(4));
      const l=control(controls,'短路支节 ls/λ',.01,.49,.001,.35,v=>v.toFixed(4));
      const label=mk('label'),check=mk('input',{type:'checkbox',checked:'checked'});label.append(check,document.createTextNode('接入并联支节'));actions.append(label);
      legend(root,[['负载到接入面的轨迹',colors.blue],['添加支节的轨迹',colors.orange],['主线接入点',colors.green]]);
      note.textContent='主线与支节 Z0=50 Ω，负载固定 25 Ω，采用实际电压反射系数 Γ 平面。橙线沿固定电导 g 的圆弧移动；只有主线先到 g=1，纯电纳支节才可能把它送到原点。';
      draw=()=>{
        const dist=d.get(),len=l.get();const gamma=cx(-Math.cos(2*TAU*dist)/3,Math.sin(2*TAU*dist)/3);
        const y=div(sub(cx(1),gamma),add(cx(1),gamma));const bs=check.checked?-1/Math.tan(TAU*len):0;
        const total=add(y,cx(0,bs));const gout=div(sub(cx(1),total),add(cx(1),total));
        const ch=chart(plot,'实际 Γ 平面：沿线与并联支节的不同轨迹',[-1.12,1.12],[-1.12,1.12],'Re Γ','Im Γ',[-1,0,1],[-1,0,1],true);
        ch.path(Array.from({length:181},(_,i)=>[Math.cos(TAU*i/180),Math.sin(TAU*i/180)]),colors.line,1.2);
        ch.path(Array.from({length:181},(_,i)=>[-.5+.5*Math.cos(TAU*i/180),.5*Math.sin(TAU*i/180)]),colors.line,1.2,'4 4');
        ch.path(Array.from({length:181},(_,i)=>[Math.cos(TAU*i/180)/3,Math.sin(TAU*i/180)/3]),colors.line,1,'3 4');
        ch.path(Array.from({length:101},(_,i)=>{const a=2*TAU*dist*i/100;return [-Math.cos(a)/3,Math.sin(a)/3];}),colors.blue);
        if(check.checked)ch.path(Array.from({length:121},(_,i)=>{const a=div(sub(cx(1),add(y,cx(0,bs*i/120))),add(cx(1),add(y,cx(0,bs*i/120))));return [a.r,a.i];}),colors.orange);
        ch.dot(-1/3,0,colors.blue);ch.dot(gamma.r,gamma.i,colors.green);ch.dot(gout.r,gout.i,colors.orange);
        ch.svg.append(sv('desc',{},'单位圆内细虚线小圆是 g=1；中心原点是匹配。蓝色沿线旋转方向随 d 增大为顺时针。'));
        readout.textContent=`主线 y=${fmt(y)}；支节 b=${bs.toFixed(3)}；合成 y=${fmt(total)}；源侧 |Γ|=${abs(gout).toFixed(5)}${abs(gout)<1e-5?'，已匹配':''}。`;
      };
      const setPair=(dist,len)=>{d.input.step='any';l.input.step='any';d.set(dist);l.set(len);check.checked=true;draw();};
      const da=Math.atan(1/Math.sqrt(2))/TAU,db=.5-da;
      button(actions,'例 2-4 方案 A',()=>setPair(da,(Math.PI-Math.atan(Math.sqrt(2)))/TAU));
      button(actions,'例 2-4 方案 B',()=>setPair(db,Math.atan(Math.sqrt(2))/TAU));
      button(actions,'复位',()=>{d.input.step='.001';l.input.step='.001';d.set(.1);l.set(.35);check.checked=true;draw();});check.addEventListener('change',()=>draw());
    } else if(kind==='waveguide'){
      title.textContent='拖动看：同一 TE₁₀ 模在截止两侧的轴向场';
      const f=control(controls,'归一化频率 f/fc,10',.55,2.2,.01,1.5,v=>v.toFixed(2));
      const t=control(controls,'观察时刻 t/T',0,1,.01,0,v=>v.toFixed(2));
      legend(root,[['瞬时横向电场',colors.blue],['场幅度包络',colors.orange]]);
      note.textContent='理想空气填充，a=22.86 mm、b=10.16 mm；截取横向场最大处，只展示该 TE10 分量。截止下选择半无限波导中远处有界的衰减支；此幅比不等于有限截止段的 S21。';
      draw=()=>{
        const q=f.get(),time=t.get(),below=q<1,at=Math.abs(q-1)<1e-9,s=Math.sqrt(Math.abs(q*q-1));
        const env=z=>below?Math.exp(-TAU*s*z):1;
        const val=z=>below?env(z)*Math.cos(TAU*time):Math.cos(TAU*(time-s*z));
        const ch=chart(plot,'TE10 沿轴向场：z 以截止波长 λc 归一化',[0,2],[-1.15,1.15],'z / λc','Ey / E0',[0,.5,1,1.5,2],[-1,0,1]);
        ch.path(samples(0,2,401,env),colors.orange,2,'6 4');ch.path(samples(0,2,401,z=>-env(z)),colors.orange,2,'6 4');ch.path(samples(0,2,601,val),colors.blue);
        if(below){readout.textContent=`截止以下：α/kc=${s.toFixed(3)}；z=λc 处场幅比 e^(−αλc)=${Math.exp(-TAU*s).toFixed(4)}；单一衰减支的平均轴向有功为 0。`;}
        else if(at){readout.textContent='恰在理想截止：β=0；传播侧极限 λg→∞、vg→0。临界点不是可用的有限功率行波工作点。';}
        else{const vg=s/q;readout.textContent=`传播区：β/kc=${s.toFixed(3)}；λg/λc=${(1/s).toFixed(3)}；vg/c=${vg.toFixed(3)}，vp/c=${(1/vg).toFixed(3)}。${q<2?'本例位于理想单模窗口。':'已到/超过 TE20 截止，不能再断言全波导只有一种传播模。'}`;}
      };
      button(actions,'截止以下 0.8 fc',()=>{f.set(.8);draw();});button(actions,'截止点 fc',()=>{f.set(1);draw();});button(actions,'传播区 1.5 fc',()=>{f.set(1.5);draw();});button(actions,'复位',()=>{f.set(1.5);t.set(0);draw();});
    } else {root.dataset.ready='';return;}
    root.append(readout,note);controls.addEventListener('input',()=>draw());draw();
    let width=0;const observer=new ResizeObserver(entries=>{const w=Math.round(entries[0].contentRect.width);if(w!==width){width=w;draw();}});observer.observe(plot);
  }
  function start(){document.querySelectorAll('.mw-demo[data-mw-demo]').forEach(init);
    const reveal=()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}if(!id)return;const e=document.getElementById(id);if(!e)return;let n=e.parentElement;while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement;}};
    window.addEventListener('hashchange',reveal);reveal();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
