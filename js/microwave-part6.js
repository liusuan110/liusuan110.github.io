/* Chapter 6: matched reference lines, lossless cascade, Wilkinson and directivity. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg',TAU=2*Math.PI;
  const C={blue:'var(--mw-blue)',green:'var(--mw-accent)',orange:'var(--mw-orange)',grid:'var(--mw-line)',ink:'var(--mw-ink)'};
  const el=(tag,attrs={},text='')=>{const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n;};
  const sv=(tag,attrs={},text='')=>{const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n;};
  const sample=(a,b,n,fn)=>Array.from({length:n},(_,i)=>{const x=a+(b-a)*i/(n-1);return[x,fn(x)];});
  const nice=(v,n=3)=>(Math.abs(v)<.5*10**(-n)?0:v).toFixed(n);
  const degrees=v=>v*Math.PI/180;
  let counter=0;
  function control(host,label,min,max,step,value,format){
    const id=`mw-p6-control-${++counter}`,box=el('div',{class:'mw-control'}),top=el('div',{class:'mw-control-top'}),input=el('input',{type:'range',id,min,max,step,value}),output=el('output',{for:id});
    top.append(el('label',{for:id},label),output);box.append(top,input);host.append(box);
    const sync=()=>{output.value=format(Number(input.value));input.setAttribute('aria-valuetext',output.value);};input.addEventListener('input',sync);sync();
    return {input,get:()=>Number(input.value),set:v=>{input.value=v;sync();}};
  }
  function button(host,text,fn){const n=el('button',{type:'button'},text);n.addEventListener('click',fn);host.append(n);}
  function legend(host,items){const n=el('div',{class:'mw-demo-legend'});for(const [text,color] of items){const s=el('span'),i=el('i');i.style.background=color;s.append(i,document.createTextNode(text));n.append(s);}host.append(n);}
  function chart(host,title,xlim,ylim,xlabel,ylabel,xt,yt,square=false){
    const w=Math.max(228,Math.floor(host.getBoundingClientRect().width)),h=square?Math.min(w+12,320):270,m={l:43,r:17,t:32,b:46};
    let pw=w-m.l-m.r,ph=h-m.t-m.b;if(square){const a=Math.min(pw,ph);m.l+=(pw-a)/2;pw=a;ph=a;}
    const X=x=>m.l+(x-xlim[0])/(xlim[1]-xlim[0])*pw,Y=y=>h-m.b-(y-ylim[0])/(ylim[1]-ylim[0])*ph;
    const svg=sv('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':title});svg.append(sv('title',{},title),sv('text',{x:m.l,y:17},ylabel));
    const line=(x1,y1,x2,y2,color=C.grid,dash='')=>{const n=sv('line',{x1:X(x1),y1:Y(y1),x2:X(x2),y2:Y(y2),stroke:color,'stroke-width':1});if(dash)n.setAttribute('stroke-dasharray',dash);svg.append(n);};
    xt.forEach(v=>{line(v,ylim[0],v,ylim[1]);svg.append(sv('text',{x:X(v),y:h-m.b+18,'text-anchor':'middle'},String(v)));});
    yt.forEach(v=>{line(xlim[0],v,xlim[1],v);svg.append(sv('text',{x:m.l-7,y:Y(v)+4,'text-anchor':'end'},String(v)));});
    svg.append(sv('text',{x:w-m.r,y:h-3,'text-anchor':'end'},xlabel));host.replaceChildren(svg);
    const path=(points,color,width=2.4,dash='')=>{const n=sv('path',{d:points.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-linejoin':'round'});if(dash)n.setAttribute('stroke-dasharray',dash);svg.append(n);};
    const dot=(x,y,color)=>svg.append(sv('circle',{cx:X(x),cy:Y(y),r:4,fill:color}));
    const arrow=(x1,y1,x2,y2,color)=>{line(x1,y1,x2,y2,color);const x=X(x2),y=Y(y2),angle=Math.atan2(y-Y(y1),x-X(x1));if(Math.hypot(x-X(x1),y-Y(y1))<4)return;svg.append(sv('path',{d:`M${x},${y}L${x-8*Math.cos(angle-.42)},${y-8*Math.sin(angle-.42)}L${x-8*Math.cos(angle+.42)},${y-8*Math.sin(angle+.42)}Z`,fill:color}));};
    return {svg,line,path,dot,arrow};
  }
  const cmul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
  const cdiv=(a,b)=>{const d=b[0]**2+b[1]**2;return[(a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d];};
  function cascade(a,b,theta){
    const p=[Math.cos(theta),-Math.sin(theta)],p2=cmul(p,p),den=[1-a*b*p2[0],-a*b*p2[1]],ta=Math.sqrt(1-a*a),tb=Math.sqrt(1-b*b);
    const refl=cdiv([a-b*p2[0],-b*p2[1]],den),trans=cdiv([-ta*tb*p[0],-ta*tb*p[1]],den);
    return {refl,trans,R:refl[0]**2+refl[1]**2,T:trans[0]**2+trans[1]**2,forward:(1-a*a)/(den[0]**2+den[1]**2)};
  }
  function init(root){
    if(root.dataset.part6Ready)return;root.dataset.part6Ready='true';
    const title=el('strong',{class:'mw-demo-title'}),controls=el('div',{class:'mw-demo-controls'}),actions=el('div',{class:'mw-demo-actions'}),panels=el('div',{class:'mw-network-panels'}),leftBox=el('div',{class:'mw-network-panel'}),rightBox=el('div',{class:'mw-network-panel'}),left=el('div',{class:'mw-demo-plot'}),right=el('div',{class:'mw-demo-plot'}),read=el('p',{class:'mw-demo-readout','aria-live':'polite','aria-atomic':'true'}),note=el('p',{class:'mw-demo-note'});
    leftBox.append(left);rightBox.append(right);panels.append(leftBox,rightBox);root.replaceChildren(title,controls,actions,panels,read,note);let draw;
    if(root.dataset.mwDemo==='network-reference'){
      title.textContent='两级网络连接：中间线相位怎样改变总透射';
      const ra=control(controls,'A 的反射系数 rA',0,.85,.05,.4,v=>v.toFixed(2)),rb=control(controls,'B 的反射系数 rB',0,.85,.05,.6,v=>v.toFixed(2)),phase=control(controls,'中间匹配线单程相位 θ',0,180,1,0,v=>`${v.toFixed(0)}°`);
      legend(leftBox,[['总透射 T',C.green],['总反射 R',C.blue],['只算一次的透射',C.orange]]);legend(rightBox,[['总 S11 轨迹',C.blue],['当前线相位',C.orange]]);
      note.textContent='两个反射片均为无耗互易模型：S11=S22=r，S12=S21=j√(1−r²)。中间线匹配、无耗，外端口按相同实数参考阻抗终接。片间单向波功率可以超过外部入射，净功率仍守恒。改变 θ 是改变两片间的实际电长度；单纯重划参考面、并同步变换外电路，不能改变物理测量结果。';
      draw=()=>{
        const a=ra.get(),b=rb.get(),theta=phase.get(),value=cascade(a,b,degrees(theta)),once=(1-a*a)*(1-b*b),ch=chart(left,'线相位与总反射、透射',[0,180],[0,1.05],'θ / °','功率 / 入射功率',[0,90,180],[0,.5,1]);
        ch.path(sample(0,180,361,x=>cascade(a,b,degrees(x)).T),C.green);ch.path(sample(0,180,361,x=>cascade(a,b,degrees(x)).R),C.blue);ch.line(0,once,180,once,C.orange,'5 4');ch.line(theta,0,theta,1,C.grid,'4 4');ch.dot(theta,value.T,C.green);ch.dot(theta,value.R,C.blue);
        const circle=chart(right,'两级连接后的输入反射系数',[-1.1,1.1],[-1.1,1.1],'Re S11','Im S11',[-1,0,1],[-1,0,1],true);
        circle.path(Array.from({length:181},(_,i)=>[Math.cos(TAU*i/180),Math.sin(TAU*i/180)]),C.grid,1.1);circle.path(Array.from({length:361},(_,i)=>cascade(a,b,degrees(i/2)).refl),C.blue);circle.arrow(0,0,...value.refl,C.orange);circle.dot(...value.refl,C.orange);
        const tp=Math.atan2(value.trans[1],value.trans[0])*180/Math.PI;
        read.textContent=`θ=${theta.toFixed(0)}°：总 T=${value.T.toFixed(6)}，R=${value.R.toFixed(6)}，R+T=${(value.R+value.T).toFixed(6)}；单次透射估计=${once.toFixed(6)}。S21=${nice(value.trans[0])} ${value.trans[1]<0?'−':'+'} j${nice(Math.abs(value.trans[1]))}，相位 ${nice(tp,1)}°；片间正向波功率/外部入射功率=${value.forward.toFixed(4)}。`;
      };
      const choose=(a,b,t)=>{ra.set(a);rb.set(b);phase.set(t);draw();};
      button(actions,'例 6-12：线相位 0°',()=>choose(.4,.6,0));button(actions,'中间线 90°',()=>{phase.set(90);draw();});button(actions,'两片相同、0°',()=>choose(.6,.6,0));button(actions,'复位',()=>choose(.4,.6,0));
    } else if(root.dataset.mwDemo==='network-wilkinson'){
      title.textContent='Wilkinson 反向合成：和模输出，差模在电阻耗散';
      const p2=control(controls,'端口 2 入射功率 P2',0,1,.05,.5,v=>`${v.toFixed(2)} W`),p3=control(controls,'端口 3 入射功率 P3',0,1,.05,.5,v=>`${v.toFixed(2)} W`),phase=control(controls,'两路入射相位差 φ',0,360,1,0,v=>`${v.toFixed(0)}°`);
      legend(leftBox,[['端口 1 输出',C.green],['隔离电阻耗散',C.orange]]);
      note.textContent='中心频率理想等分 Wilkinson：Z0=50 Ω，两支路为 70.71 Ω 的 λg/4 线，隔离电阻 100 Ω。此处端口 1 接匹配负载、仅从端口 2 和 3 入射。沿用全篇峰值波约定 P=|a|²/2；理想正向等分时电阻不耗能，不能据此把完整三端口判为无耗。';
      draw=()=>{
        const a=p2.get(),b=p3.get(),phi=phase.get(),total=a+b,cross=2*Math.sqrt(a*b),power=t=>Math.max(0,(total+cross*Math.cos(degrees(t)))/2),out=power(phi),heat=Math.max(0,total-out),top=Math.max(.5,total),yt=[0,top/2,top].map(v=>Number(v.toFixed(2)));
        const ch=chart(left,'相位差与两条功率去向',[0,360],[0,top*1.06],'φ / °','P / W',[0,180,360],yt);
        ch.path(sample(0,360,361,power),C.green);ch.path(sample(0,360,361,x=>total-power(x)),C.orange);ch.line(phi,0,phi,top,C.grid,'4 4');ch.dot(phi,out,C.green);ch.dot(phi,heat,C.orange);
        const w=Math.max(228,Math.floor(right.getBoundingClientRect().width)),svg=sv('svg',{viewBox:`0 0 ${w} 270`,role:'img','aria-label':'输入功率分成和模输出与隔离电阻耗散'}),x=18,bar=w-36,scale=total>0?total:1;
        svg.append(sv('title',{},'功率分解与隔离电阻'),sv('text',{x,y:19},`总入射 ${total.toFixed(3)} W`));
        [[out,C.green,'端口 1：和模输出',62],[heat,C.orange,'100 Ω 电阻：差模耗散',132]].forEach(([p,color,label,y])=>{svg.append(sv('text',{x,y},label),sv('rect',{x,y:y+10,width:bar,height:16,rx:4,fill:C.grid}),sv('rect',{x,y:y+10,width:bar*p/scale,height:16,rx:4,fill:color}),sv('text',{x:w-18,y:y+46,'text-anchor':'end'},`${p.toFixed(3)} W`));});
        svg.append(sv('text',{x,y:219},`电阻两端 RMS 电压：${Math.sqrt(100*heat).toFixed(3)} V`),sv('text',{x,y:246},'输入等幅同相 → 电阻电压为零'));right.replaceChildren(svg);
        read.textContent=`P2+P3=${total.toFixed(3)} W；端口 1 输出=${out.toFixed(3)} W，隔离电阻耗散=${heat.toFixed(3)} W，输出加耗散=${(out+heat).toFixed(3)} W。合成效率=${total>0?(100*out/total).toFixed(2)+'%':'—（无入射）'}；电阻两端 VRMS=${Math.sqrt(100*heat).toFixed(3)} V。`;
      };
      const choose=(a,b,t)=>{p2.set(a);p3.set(b);phase.set(t);draw();};
      button(actions,'例 6-14：等幅同相',()=>choose(.5,.5,0));button(actions,'相差 90°',()=>{phase.set(90);draw();});button(actions,'相差 180°',()=>{phase.set(180);draw();});button(actions,'只有端口 2 输入',()=>choose(1,0,0));button(actions,'复位',()=>choose(.5,.5,0));
    } else if(root.dataset.mwDemo==='network-directivity'){
      title.textContent='有限定向性：泄漏矢量怎样拉偏反射测量';
      const rl=control(controls,'真实回波损耗 RL',10,60,1,30,v=>`${v.toFixed(0)} dB`),direct=control(controls,'测量方向的定向性 D',20,60,1,40,v=>`${v.toFixed(0)} dB`),phase=control(controls,'泄漏与真实反射的相位差 φ',0,360,1,0,v=>`${v.toFixed(0)}°`);
      legend(leftBox,[['可能测得的 RL',C.green],['真实 RL',C.blue]]);legend(rightBox,[['真实反射',C.blue],['泄漏矢量',C.orange],['测得的反射',C.green]]);
      note.textContent='采用已校准耦合比例的简化误差模型 Γm=Γ+ε·exp(jφ)，ε=10^(−D/20)，并以真实反射相位为零。只研究定向性误差，忽略源匹配、接收机噪声和跟踪误差。理想匹配负载 Γ=0 时，此模型测得的回波损耗等于 D；真实矢量恰好抵消时，理想读数可趋于无穷，不能解释成测量精度无限。';
      draw=()=>{
        const R=rl.get(),D=direct.get(),phi=phase.get(),g=10**(-R/20),eps=10**(-D/20),ratio=eps/g;
        const magnitude=t=>Math.hypot(g+eps*Math.cos(degrees(t)),eps*Math.sin(degrees(t))),m=magnitude(phi),low=-20*Math.log10(g+eps),nullPossible=Math.abs(g-eps)<1e-14,high=nullPossible?Infinity:-20*Math.log10(Math.abs(g-eps)),limit=Math.min(120,nullPossible?R+40:high+3),bottom=Math.max(0,low-3),mRL=m<1e-14?Infinity:-20*Math.log10(m),powerRL=t=>Math.min(limit,-20*Math.log10(Math.max(1e-16,magnitude(t))));
        const ticks=[bottom,(bottom+limit)/2,limit].map(v=>Number(v.toFixed(1))),ch=chart(left,'泄漏相位与测得的回波损耗',[0,360],[bottom,limit],'φ / °','RLm / dB',[0,180,360],ticks);
        ch.path(sample(0,360,361,powerRL),C.green);if(R>=bottom&&R<=limit)ch.line(0,R,360,R,C.blue,'5 4');ch.line(phi,bottom,phi,limit,C.grid,'4 4');ch.dot(phi,Math.min(limit,mRL),C.green);
        const extent=Number((Math.max(1.35,1+ratio)*1.12).toPrecision(2)),circ=chart(right,'误差矢量圆：相对真实反射幅度',[-extent,extent],[-extent,extent],'Re Γm / |Γ|','Im Γm / |Γ|',[-extent,0,extent],[-extent,0,extent],true),x=1+ratio*Math.cos(degrees(phi)),y=ratio*Math.sin(degrees(phi));
        circ.path(Array.from({length:181},(_,i)=>[1+ratio*Math.cos(TAU*i/180),ratio*Math.sin(TAU*i/180)]),C.grid,1.5,'4 3');circ.arrow(0,0,1,0,C.blue);circ.arrow(1,0,x,y,C.orange);circ.arrow(0,0,x,y,C.green);circ.dot(x,y,C.green);
        const upper=Number.isFinite(high)?high.toFixed(3)+' dB':'∞',measured=Number.isFinite(mRL)?mRL.toFixed(3)+' dB':'∞（理想矢量相消）';
        read.textContent=`|Γ|=${g.toFixed(6)}，ε=${eps.toFixed(6)}；测得 |Γm|=${m.toFixed(6)}，RLm=${measured}。随未知相位变化，RLm 范围为 ${low.toFixed(3)} dB 至 ${upper}；当前反射幅度相对误差=${((m/g-1)*100).toFixed(2)}%，最坏幅度误差界=${(ratio*100).toFixed(2)}%。`;
      };
      const choose=(r,d,p)=>{rl.set(r);direct.set(d);phase.set(p);draw();};
      button(actions,'例 6-16：RL 30 / D 40',()=>choose(30,40,0));button(actions,'泄漏反相 180°',()=>{phase.set(180);draw();});button(actions,'定向性提高到 50 dB',()=>{direct.set(50);draw();});button(actions,'误差相当：RL=D=40',()=>choose(40,40,180));button(actions,'复位',()=>choose(30,40,0));
    } else return;
    controls.addEventListener('input',()=>draw());draw();root.dataset.ready='true';
    let previousWidth=0;const observer=new ResizeObserver(entries=>{const w=Math.round(entries[0].contentRect.width);if(w!==previousWidth){previousWidth=w;draw();}});observer.observe(panels);
  }
  function start(){document.querySelectorAll('[data-mw-demo="network-reference"],[data-mw-demo="network-wilkinson"],[data-mw-demo="network-directivity"]').forEach(init);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
