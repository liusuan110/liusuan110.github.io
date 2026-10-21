/* Chapter 5: lossless capacitor tuning and isolated loaded-mode response models. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg',TAU=2*Math.PI;
  const C={blue:'var(--mw-blue)',green:'var(--mw-accent)',orange:'var(--mw-orange)',grid:'var(--mw-line)',ink:'var(--mw-ink)',paper:'var(--mw-paper)'};
  const el=(tag,attrs={},text='')=>{const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n;};
  const sv=(tag,attrs={},text='')=>{const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n;};
  const sample=(a,b,n,fn)=>Array.from({length:n},(_,i)=>{const x=a+(b-a)*i/(n-1);return[x,fn(x)];});
  const nice=(v,n=3)=>(Math.abs(v)<.5*10**(-n)?0:v).toFixed(n);
  let counter=0;
  function control(host,label,min,max,step,value,format){
    const id=`mw-p5-control-${++counter}`,box=el('div',{class:'mw-control'}),top=el('div',{class:'mw-control-top'}),input=el('input',{type:'range',id,min,max,step,value}),output=el('output',{for:id});
    top.append(el('label',{for:id},label),output);box.append(top,input);host.append(box);
    const sync=()=>{output.value=format(Number(input.value));input.setAttribute('aria-valuetext',output.value);};input.addEventListener('input',sync);sync();
    return {input,get:()=>Number(input.value),set:v=>{input.value=v;sync();}};
  }
  function button(host,text,fn){const n=el('button',{type:'button'},text);n.addEventListener('click',fn);host.append(n);return n;}
  function legend(host,items){const n=el('div',{class:'mw-demo-legend'});for(const [text,color] of items){const s=el('span'),i=el('i');i.style.background=color;s.append(i,document.createTextNode(text));n.append(s);}host.append(n);}
  function chart(host,title,xlim,ylim,xlabel,ylabel,xt,yt,square=false){
    const w=Math.max(228,Math.floor(host.getBoundingClientRect().width)),h=square?Math.min(w+12,320):260,m={l:44,r:17,t:31,b:43};
    let pw=w-m.l-m.r,ph=h-m.t-m.b;if(square){const a=Math.min(pw,ph);m.l+=(pw-a)/2;pw=a;ph=a;}
    const X=x=>m.l+(x-xlim[0])/(xlim[1]-xlim[0])*pw,Y=y=>h-m.b-(y-ylim[0])/(ylim[1]-ylim[0])*ph;
    const svg=sv('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':title});svg.append(sv('title',{},title),sv('text',{x:m.l,y:17},ylabel));
    const line=(x1,y1,x2,y2,color=C.grid,dash='')=>{const n=sv('line',{x1:X(x1),y1:Y(y1),x2:X(x2),y2:Y(y2),stroke:color,'stroke-width':1});if(dash)n.setAttribute('stroke-dasharray',dash);svg.append(n);};
    xt.forEach(v=>{line(v,ylim[0],v,ylim[1]);svg.append(sv('text',{x:X(v),y:h-m.b+18,'text-anchor':'middle'},String(v)));});
    yt.forEach(v=>{line(xlim[0],v,xlim[1],v);svg.append(sv('text',{x:m.l-7,y:Y(v)+4,'text-anchor':'end'},String(v)));});
    svg.append(sv('text',{x:w-m.r,y:h-3,'text-anchor':'end'},xlabel));host.replaceChildren(svg);
    const path=(points,color,width=2.4,dash='')=>{const n=sv('path',{d:points.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-linejoin':'round'});if(dash)n.setAttribute('stroke-dasharray',dash);svg.append(n);};
    const dot=(x,y,color)=>svg.append(sv('circle',{cx:X(x),cy:Y(y),r:4,fill:color}));return {svg,line,path,dot};
  }
  function schematic(host,title){
    const w=Math.max(228,Math.floor(host.getBoundingClientRect().width)),h=260,svg=sv('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':title});svg.append(sv('title',{},title),sv('text',{x:12,y:18},title));host.replaceChildren(svg);return {svg,w,h};
  }
  function tune(Lmm,Cpf){
    const L=Lmm*1e-3,Cp=Cpf*1e-12,quarter=2e8/(4*L);
    if(Cp===0)return {f0:quarter,ratio:1,quarter};
    const k=2e8*Cp*50/L;let lo=0,hi=Math.PI/2;
    for(let i=0;i<64;i++){const theta=(lo+hi)/2;if(k*theta-1/Math.tan(theta)>0)hi=theta;else lo=theta;}
    const ratio=(lo+hi)/Math.PI;return {f0:quarter*ratio,ratio,quarter};
  }
  function init(root){
    if(root.dataset.part5Ready)return;root.dataset.part5Ready='true';root.dataset.ready='true';
    const title=el('strong',{class:'mw-demo-title'}),controls=el('div',{class:'mw-demo-controls'}),actions=el('div',{class:'mw-demo-actions'}),panels=el('div',{class:'mw-resonator-panels'}),leftBox=el('div',{class:'mw-resonator-panel'}),rightBox=el('div',{class:'mw-resonator-panel'}),left=el('div',{class:'mw-demo-plot'}),right=el('div',{class:'mw-demo-plot'}),read=el('p',{class:'mw-demo-readout','aria-live':'polite','aria-atomic':'true'}),note=el('p',{class:'mw-demo-note'});
    leftBox.append(left);rightBox.append(right);panels.append(leftBox,rightBox);root.replaceChildren(title,controls,actions,panels,read,note);let draw;
    if(root.dataset.mwDemo==='resonator-tuning'){
      title.textContent='加载调谐：固定线长，电容怎样移动谐振点';
      const length=control(controls,'短路线长度 L',10,35,.1,20,v=>`${v.toFixed(1)} mm`);
      const cap=control(controls,'输入端并联电容 C',0,3,.05,1,v=>`${v.toFixed(2)} pF`);
      const probe=control(controls,'观察频率 f / f四分之一波长',.2,1.05,.005,.75,v=>v.toFixed(4));
      legend(rightBox,[['−Zc·B短路线',C.blue],['Zc·B电容',C.green]]);
      note.textContent='Zc=50 Ω，u=2×10⁸ m/s，理想无耗 TEM 线及集中电容。横轴频率以同长度未加载时的 u/(4L) 归一化。两条电纳绝对量相等时总电纳为零；这里只判断并联谐振，尚未规定端口匹配或实际有载 Q。';
      draw=()=>{
        const L=length.get(),Cp=cap.get(),r=tune(L,Cp),q=probe.get(),f=r.quarter*q,theta=Math.PI*q/2;
        const bcap=TAU*f*Cp*1e-12,bline=-1/(50*Math.tan(theta)),total=(bcap+bline)*1e3;
        const {svg,w}=schematic(left,'电路与参考面：并联电容＋短路线');const y=116,lower=202,x=43,end=w-24;
        svg.append(sv('line',{x1:x,y1:y,x2:end,y2:y,stroke:C.ink,'stroke-width':2}),sv('line',{x1:x,y1:lower,x2:end,y2:lower,stroke:C.ink,'stroke-width':2}),sv('line',{x1:end,y1:y,x2:end,y2:lower,stroke:C.ink,'stroke-width':4}),sv('circle',{cx:x,cy:y,r:4,fill:C.orange}),sv('circle',{cx:x,cy:lower,r:4,fill:C.orange}));
        svg.append(sv('line',{x1:x,y1:y,x2:x,y2:151,stroke:C.green,'stroke-width':2}),sv('line',{x1:x-12,y1:151,x2:x+12,y2:151,stroke:C.green,'stroke-width':3}),sv('line',{x1:x-12,y1:164,x2:x+12,y2:164,stroke:C.green,'stroke-width':3}),sv('line',{x1:x,y1:164,x2:x,y2:lower,stroke:C.green,'stroke-width':2}));
        svg.append(sv('text',{x:14,y:70},'输入参考面'),sv('text',{x:end,y:102,'text-anchor':'end'},'远端短路'),sv('text',{x:x+19,y:162},`${Cp.toFixed(2)} pF`),sv('text',{x:(x+end)/2,y:230,'text-anchor':'middle'},`L=${L.toFixed(1)} mm，Zc=50 Ω`),sv('text',{x:w/2,y:253,'text-anchor':'middle'},`未加载 fλ/4=${(r.quarter/1e9).toFixed(3)} GHz`));
        const ch=chart(right,'电纳相消确定基模谐振点',[.2,1.05],[-.15,5.2],'f / fλ/4','归一化电纳',[.2,.4,.6,.8,1],[0,2.5,5]);
        ch.path(sample(.2,1.05,241,x=>1/Math.tan(Math.PI*x/2)),C.blue);
        const k=TAU*r.quarter*Cp*1e-12*50;ch.path(sample(.2,1.05,241,x=>k*x),C.green);
        ch.line(r.ratio,-.1,r.ratio,5,C.orange,'4 4');ch.dot(r.ratio,k*r.ratio,C.orange);ch.dot(q,1/Math.tan(theta),C.blue);ch.dot(q,k*q,C.green);
        read.textContent=`基模 f0=${(r.f0/1e9).toFixed(6)} GHz；观察 f=${(f/1e9).toFixed(6)} GHz，βL=${(theta*180/Math.PI).toFixed(3)}°；总电纳 B=${nice(total)} mS${Math.abs(total)<1e-7?'，已到谐振点':''}。`;
      };
      button(actions,'例 5-8：20 mm、1 pF',()=>{length.set(20);cap.set(1);probe.input.step='any';probe.set(tune(20,1).ratio);draw();});
      button(actions,'电容为零',()=>{cap.set(0);draw();});button(actions,'移到谐振点',()=>{probe.input.step='any';probe.set(tune(length.get(),cap.get()).ratio);draw();});button(actions,'复位',()=>{length.set(20);cap.set(1);probe.input.step='.005';probe.set(.75);draw();});
    } else if(root.dataset.mwDemo==='resonator-ringdown'){
      title.textContent='自由衰减：同一个 Q，连接时间包络与频率峰宽';
      const q=control(controls,'有载品质因数 QL',1000,20000,100,5000,v=>v.toFixed(1));
      const freq=control(controls,'谐振频率 f0',1,10,.1,5,v=>`${v.toFixed(1)} GHz`);
      const time=control(controls,'观察时刻 t/τW',0,5,.05,1,v=>v.toFixed(3));
      legend(leftBox,[['场幅包络 A/A0',C.blue],['总储能 W/W0',C.orange]]);legend(rightBox,[['孤立模归一化功率谱',C.green],['半功率点',C.orange]]);
      note.textContent='停止驱动后，端口仍接匹配外电路，所以使用 QL。左图画已去除载波的场幅包络与总储能，不是瞬时正弦场。右图是对应单模窄带洛伦兹功率响应；幅度的 20log10 与能量的 10log10 给出同一 dB 衰减，但二者线性时间常数相差两倍。';
      draw=()=>{
        const Q=q.get(),f=freq.get()*1e9,tau=Q/(TAU*f),tauNs=tau*1e9,t=time.get(),a=Math.exp(-t/2),energy=Math.exp(-t),bw=f/Q/1e6;
        const unit=tauNs*5>2000?'μs':'ns',factor=unit==='μs'?1000:1,axisTau=tauNs/factor,end=axisTau*5;
        const xt=[0,axisTau*2,axisTau*4].map(v=>Number(v.toPrecision(3)));
        const ch=chart(left,'同一谐振模的场幅和能量衰减',[0,end],[0,1.05],`t / ${unit}`,'相对初值',xt,[0,.5,1]);
        ch.path(sample(0,end,251,x=>Math.exp(-x/(2*axisTau))),C.blue);ch.path(sample(0,end,251,x=>Math.exp(-x/axisTau)),C.orange);ch.dot(t*axisTau,a,C.blue);ch.dot(t*axisTau,energy,C.orange);ch.line(t*axisTau,0,t*axisTau,1,C.grid,'4 4');
        const half=chart(right,'对应的半功率带宽',[ -2*bw,2*bw],[0,1.05],'(f−f0) / MHz','P / P峰',[-bw,0,bw].map(v=>Number(v.toPrecision(3))),[0,.5,1]);
        half.path(sample(-2*bw,2*bw,361,x=>1/(1+(2*x/bw)**2)),C.green);half.line(-2*bw,.5,2*bw,.5,C.grid,'4 4');half.dot(-bw/2,.5,C.orange);half.dot(bw/2,.5,C.orange);
        read.textContent=`τW=${tauNs.toFixed(3)} ns，τA=${(2*tauNs).toFixed(3)} ns；Δf=${bw.toFixed(6)} MHz。t=${(t*tauNs).toFixed(3)} ns 时，A/A0=${a.toFixed(4)}，W/W0=${energy.toFixed(4)}，对应 ${(-10*t/Math.LN10).toFixed(3)} dB。`;
      };
      button(actions,'例 5-9：幅度 100 ns 减半',()=>{q.input.step='any';time.input.step='any';freq.set(5);q.set(TAU*5e9*100e-9/(2*Math.LN2));time.set(2*Math.LN2);draw();});button(actions,'一个能量时间常数',()=>{time.set(1);draw();});button(actions,'复位',()=>{q.input.step='100';time.input.step='.05';q.set(5000);freq.set(5);time.set(1);draw();});
    } else if(root.dataset.mwDemo==='resonator-coupling'){
      title.textContent='端口耦合：同一腔体，反射谷为何会有不同含义';
      const k1=control(controls,'输入耦合 κ1=Q0/Qe,1',.1,4,.05,1.5,v=>v.toFixed(3));
      const k2=control(controls,'输出耦合 κ2=Q0/Qe,2',0,2,.05,.5,v=>v.toFixed(3));
      const detune=control(controls,'观察频差 f−f0',-3,3,.02,0,v=>`${v.toFixed(2)} MHz`);
      legend(leftBox,[['反射 R',C.blue],['传输 T',C.green],['内部吸收 A',C.orange]]);legend(rightBox,[['S11 轨迹',C.blue],['谐振点',C.green],['观察点',C.orange]]);
      note.textContent='固定 Q0=10000、f0=5 GHz；单模窄带、无额外输入—输出直通背景，所有外电路匹配。三条功率按端口1入射功率归一化。反射轨迹采用本文校准后的端口相位约定；改变参考面会转动相位，不能把未经校准的相位直接套入判据。';
      draw=()=>{
        const b1=k1.get(),b2=k2.get(),D=1+b1+b2,QL=10000/D,bw=.5*D,df=detune.get();
        const state=xMHz=>{const x=2*xMHz/bw,p=2*b1/D,den=1+x*x,re=1-p/den,im=p*x/den;return{re,im,R:re*re+im*im,T:4*b1*b2/(D*D*den),A:4*b1/(D*D*den)};};
        const value=state(df),peak=state(0),ch=chart(left,'反射、传输与内部吸收',[ -3,3],[0,1.05],'(f−f0) / MHz','功率 / 入射功率',[-3,0,3],[0,.5,1]);
        ch.path(sample(-3,3,401,x=>state(x).R),C.blue);ch.path(sample(-3,3,401,x=>state(x).T),C.green);ch.path(sample(-3,3,401,x=>state(x).A),C.orange);
        ch.dot(df,value.R,C.blue);ch.dot(df,value.T,C.green);ch.dot(df,value.A,C.orange);ch.line(df,0,df,1,C.grid,'4 4');
        const circle=chart(right,'输入反射系数的复平面',[-1.1,1.1],[-1.1,1.1],'Re S11','Im S11',[-1,0,1],[-1,0,1],true);
        circle.path(Array.from({length:181},(_,i)=>[Math.cos(TAU*i/180),Math.sin(TAU*i/180)]),C.grid,1.1);
        const center=1-b1/D,radius=b1/D;
        circle.path(Array.from({length:181},(_,i)=>[center+radius*Math.cos(TAU*i/180),radius*Math.sin(TAU*i/180)]),C.blue);
        circle.dot(peak.re,0,C.green);circle.dot(value.re,value.im,C.orange);
        const matching=Math.abs(b1-1-b2)<1e-8?'谐振处输入匹配':b1<1+b2?'相对其余通道：输入欠耦合':'相对其余通道：输入过耦合';
        read.textContent=`QL=${QL.toFixed(2)}，Δf=${bw.toFixed(3)} MHz；${matching}。谐振处 R=${peak.R.toFixed(4)}，T=${peak.T.toFixed(4)}，A=${peak.A.toFixed(4)}；观察点 S11=${nice(value.re)} ${value.im<0?'−':'+'} j${nice(Math.abs(value.im))}，R+T+A=${(value.R+value.T+value.A).toFixed(6)}。`;
      };
      const choose=(b1,b2)=>{k1.input.step='any';k2.input.step='any';k1.set(b1);k2.set(b2);detune.set(0);draw();};
      button(actions,'单端口欠耦合',()=>choose(1/3,0));button(actions,'单端口临界耦合',()=>choose(1,0));button(actions,'单端口过耦合',()=>choose(3,0));button(actions,'例 5-11：双端口匹配',()=>choose(1.5,.5));button(actions,'复位',()=>{k1.input.step='.05';k2.input.step='.05';k1.set(1.5);k2.set(.5);detune.set(0);draw();});
    } else return;
    controls.addEventListener('input',()=>draw());draw();
    let previousWidth=0;const observer=new ResizeObserver(entries=>{const w=Math.round(entries[0].contentRect.width);if(w!==previousWidth){previousWidth=w;draw();}});observer.observe(panels);
  }
  function start(){document.querySelectorAll('[data-mw-demo="resonator-tuning"],[data-mw-demo="resonator-ringdown"],[data-mw-demo="resonator-coupling"]').forEach(init);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
