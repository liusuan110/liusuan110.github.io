/* Chapter 4: analytic circular eigenfunctions, low-loss coax and quasi-static microstrip. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg',TAU=2*Math.PI;
  const C={blue:'var(--mw-blue)',green:'var(--mw-accent)',orange:'var(--mw-orange)',grid:'var(--mw-line)',ink:'var(--mw-ink)',paper:'var(--mw-paper)'};
  const el=(tag,attrs={},text='')=>{const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n;};
  const sv=(tag,attrs={},text='')=>{const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n;};
  let counter=0;
  const j1=x=>{let term=x/2,sum=term;for(let k=1;k<28;k++){term*=-(x*x/4)/(k*(k+1));sum+=term;if(Math.abs(term)<1e-16)break;}return sum;};
  function microstrip(p,er){
    const F=1/Math.sqrt(1+12/p)+(p<1?.04*(1-p)**2:0);
    const ee=(er+1)/2+(er-1)*F/2;
    const z=p<=1?60/Math.sqrt(ee)*Math.log(8/p+p/4):120*Math.PI/(Math.sqrt(ee)*(p+1.393+.667*Math.log(p+1.444)));
    return {ee,z};
  }
  function widthFor(z,er){let a=.1,b=8;for(let k=0;k<64;k++){const m=(a+b)/2;if(microstrip(m,er).z>z)a=m;else b=m;}return(a+b)/2;}
  const sample=(a,b,n,fn)=>Array.from({length:n},(_,i)=>{const x=a+(b-a)*i/(n-1);return[x,fn(x)];});
  function plot(host,title,xlim,ylim,xlabel,ylabel,xt,yt){
    const w=Math.max(228,Math.floor(host.getBoundingClientRect().width)),h=260,m={l:43,r:16,t:34,b:43};
    const X=x=>m.l+(x-xlim[0])/(xlim[1]-xlim[0])*(w-m.l-m.r);
    const Y=y=>h-m.b-(y-ylim[0])/(ylim[1]-ylim[0])*(h-m.t-m.b);
    const svg=sv('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':title});svg.append(sv('title',{},title),sv('text',{x:m.l,y:17},ylabel));
    const line=(x1,y1,x2,y2,c=C.grid,dash='')=>{const n=sv('line',{x1:X(x1),y1:Y(y1),x2:X(x2),y2:Y(y2),stroke:c,'stroke-width':1});if(dash)n.setAttribute('stroke-dasharray',dash);svg.append(n);};
    xt.forEach(v=>{line(v,ylim[0],v,ylim[1]);svg.append(sv('text',{x:X(v),y:h-m.b+18,'text-anchor':'middle'},String(v)));});
    yt.forEach(v=>{line(xlim[0],v,xlim[1],v);svg.append(sv('text',{x:m.l-7,y:Y(v)+4,'text-anchor':'end'},String(v)));});
    svg.append(sv('text',{x:w-m.r,y:h-4,'text-anchor':'end'},xlabel));host.replaceChildren(svg);
    return {svg,line,path:(points,color)=>svg.append(sv('path',{d:points.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' '),stroke:color,'stroke-width':2.5,fill:'none','stroke-linejoin':'round'})),dot:(x,y,color)=>svg.append(sv('circle',{cx:X(x),cy:Y(y),r:4,fill:color}))};
  }
  function control(host,label,min,max,step,value,format){
    const id=`mw-p4-${++counter}`,box=el('div',{class:'mw-control'}),top=el('div',{class:'mw-control-top'}),input=el('input',{type:'range',id,min,max,step,value}),output=el('output',{for:id});
    top.append(el('label',{for:id},label),output);box.append(top,input);host.append(box);
    const sync=()=>{output.value=format(Number(input.value));input.setAttribute('aria-valuetext',output.value);};input.addEventListener('input',sync);sync();
    return {input,get:()=>Number(input.value),set:v=>{input.value=v;sync();}};
  }
  function button(host,text,fn){const n=el('button',{type:'button'},text);n.addEventListener('click',fn);host.append(n);}
  function frame(host,title){
    const w=Math.max(228,Math.floor(host.getBoundingClientRect().width)),h=260;
    const svg=sv('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':title});svg.append(sv('title',{},title),sv('text',{x:12,y:17},title));host.replaceChildren(svg);return {svg,w,h};
  }
  function init(root){
    if(root.dataset.part4Ready)return;root.dataset.part4Ready='true';root.dataset.ready='true';
    const kind=root.dataset.mwDemo,title=el('strong',{class:'mw-demo-title'}),controls=el('div',{class:'mw-demo-controls'}),actions=el('div',{class:'mw-demo-actions'}),panels=el('div',{class:'mw-part4-panels'}),left=el('div',{class:'mw-demo-plot'}),right=el('div',{class:'mw-demo-plot'}),read=el('p',{class:'mw-demo-readout','aria-live':'polite','aria-atomic':'true'}),note=el('p',{class:'mw-demo-note'});
    panels.append(left,right);root.replaceChildren(title,controls,actions,panels,read,note);let draw;
    if(kind==='circular'){
      title.textContent='圆波导：改变方位组合，同时检查允许传播的模式族';
      const q=control(controls,'工作点 kR',1.5,4.4,.01,2.1,v=>v.toFixed(2));
      const amp=control(controls,'正弦基分量 B/A',0,1,.05,0,v=>v.toFixed(2));
      const phase=control(controls,'两基分量相位差 δ',-180,180,5,0,v=>`${v}°`);
      const time=control(controls,'观察时刻 t/T',0,1,.01,0,v=>v.toFixed(2));
      const modes=[['TE11',1.8412,2],['TM01',2.4048,1],['TE21',3.0542,2],['TE01',3.8317,1],['TM11',3.8317,2],['TE31',4.2012,2]];
      note.textContent='左图为 TE11 的归一化纵向磁场 Hz 瞬时正负分布，蓝正、橙负；不是横向电场箭头，也不是完整电磁仿真；各点局部电场不必都为圆极化。固定角频率时，时间滑块改变观察时刻；kR 只用于选择传播状态，不自动把所有可传播模都激励出来。';
      draw=()=>{
        const work=q.get(),b=amp.get(),d=phase.get()*Math.PI/180,t=TAU*time.get();
        const aField=Math.cos(t),bField=b*Math.cos(t+d);
        const {svg,w}=frame(left,'TE11：瞬时 Hz 横截面');
        const rad=Math.min((w-55)/2,93),x=w/2,y=140,clip=`mw-p4-clip-${root.id}`;
        const defs=sv('defs'),cp=sv('clipPath',{id:clip});cp.append(sv('circle',{cx:x,cy:y,r:rad}));defs.append(cp);svg.append(defs,sv('circle',{cx:x,cy:y,r:rad,fill:C.paper}));
        const group=sv('g',{'clip-path':`url(#${clip})`}),n=31,h=2*rad/n;
        for(let i=0;i<n;i++)for(let k=0;k<n;k++){
          const xx=-1+(i+.5)*2/n,yy=-1+(k+.5)*2/n,r=Math.hypot(xx,yy);if(r>1.05)continue;
          const field=r<1e-9?0:j1(1.8412*r)/j1(1.8412)*(aField*xx+bField*yy)/r;
          group.append(sv('rect',{x:x-rad+i*h,y:y+rad-(k+1)*h,width:h+.3,height:h+.3,fill:field>=0?C.blue:C.orange,opacity:Math.min(.95,Math.abs(field)/Math.SQRT2)}));
        }
        svg.append(group,sv('circle',{cx:x,cy:y,r:rad,stroke:C.ink,'stroke-width':1.5,fill:'none'}),sv('line',{x1:x-rad,y1:y,x2:x+rad,y2:y,stroke:C.grid,'stroke-dasharray':'3 4'}),sv('line',{x1:x,y1:y-rad,x2:x,y2:y+rad,stroke:C.grid,'stroke-dasharray':'3 4'}),sv('text',{x:x+rad+6,y:y+4},'x'),sv('text',{x:x+5,y:y-rad-7},'y'),sv('text',{x:x,y:252,'text-anchor':'middle'},'同一 TE11 族的两方位基函数'));
        const g=frame(right,'根谱：根 < kR 才允许传播'),m=g.svg;
        const l=58,rw=g.w-l-15,X=v=>l+(v-1.5)/3*rw;
        [1.5,2.5,3.5,4.5].forEach(v=>{m.append(sv('line',{x1:X(v),y1:31,x2:X(v),y2:219,stroke:C.grid}),sv('text',{x:X(v),y:239,'text-anchor':'middle'},String(v)));});
        modes.forEach(([name,rootVal],i)=>{const yy=43+i*32,active=rootVal<work;
          m.append(sv('text',{x:l-8,y:yy+4,'text-anchor':'end'},name),sv('line',{x1:X(rootVal),y1:yy,x2:X(4.5),y2:yy,stroke:active?C.green:C.grid,'stroke-width':3}),sv('circle',{cx:X(rootVal),cy:yy,r:4,fill:active?C.green:C.grid}));
        });
        m.append(sv('line',{x1:X(work),y1:29,x2:X(work),y2:222,stroke:C.orange,'stroke-width':2,'stroke-dasharray':'4 3'}),sv('text',{x:g.w-15,y:257,'text-anchor':'end'},'截止根 ξ 与工作点 kR'));
        const allowed=modes.filter(m=>m[1]<work),count=allowed.reduce((a,m)=>a+m[2],0);
        const type=b<1e-7||Math.abs(Math.sin(d))<1e-7?'线极化组合':Math.abs(b-1)<1e-7&&Math.abs(Math.cos(d))<1e-7?'等幅正交相位：旋转模态组合':'椭圆极化组合';
        read.textContent=`${type}；当前允许 ${allowed.length} 个模式族、计方位简并 ${count} 个独立模。${work<=1.8412?'TE11 尚未超过截止，左图只显示横向基函数形状。':work<2.4048?'只有 TE11 族可传播，但仍有两个方位自由度。':'有其他模式族也可传播，是否实际出现取决于激励。'}`;
      };
      button(actions,'单方位',()=>{amp.set(0);phase.set(0);draw();});button(actions,'同相等幅',()=>{amp.set(1);phase.set(0);draw();});button(actions,'正交相位等幅',()=>{amp.set(1);phase.set(90);draw();});button(actions,'复位',()=>{q.set(2.1);amp.set(0);phase.set(0);time.set(0);draw();});
    } else if(kind==='coax'){
      title.textContent='同轴线：固定外尺寸，线径比怎样同时改变损耗与功率';
      const ratio=control(controls,'半径比 b/a',1.2,6,.01,2.3,v=>v.toFixed(3));
      const outer=control(controls,'外导体内半径 b',.5,5,.1,2,v=>`${v.toFixed(1)} mm`);
      const freq=control(controls,'频率 f',.1,20,.1,5,v=>`${v.toFixed(1)} GHz`);
      note.textContent='蓝线示意径向 E，绿虚圆示意环向 H。空气均匀填充，光滑铜内外导体，σ=5.8×10⁷ S/m；小损耗集肤模型，忽略介质损耗。题设击穿场峰值固定 3 MV/m，功率为匹配单向 TEM 的理想击穿约束上限；它不是线缆额定功率。高阶截止仅按平均圆周公式估算。';
      draw=()=>{
        const r=ratio.get(),b=outer.get()*1e-3,a=b/r,f=freq.get()*1e9,z=60*Math.log(r),rs=Math.sqrt(Math.PI*f*4e-7*Math.PI/5.8e7);
        const alpha=rs*(1/a+1/b)/(4*Math.PI*z),alphaDb=alpha*20/Math.log(10),v=3e6*a*Math.log(r),p=v*v/(2*z),fc=3e8/(Math.PI*(a+b));
        const {svg,w}=frame(left,'TEM 截面：径向 E，环向 H');const x=w/2,y=140,R=88,A=R/r;
        svg.append(sv('circle',{cx:x,cy:y,r:R,fill:C.paper,stroke:C.ink,'stroke-width':8}));
        for(let k=0;k<8;k++){const th=TAU*k/8,cs=Math.cos(th),sn=Math.sin(th),start=A+5,end=R-8;
          svg.append(sv('line',{x1:x+start*cs,y1:y-start*sn,x2:x+end*cs,y2:y-end*sn,stroke:C.blue,'stroke-width':1.7}));
          const px=x+end*cs,py=y-end*sn,ux=-cs*5,uy=sn*5;
          svg.append(sv('path',{d:`M${px+ux-sn*3},${py+uy-cs*3}L${px},${py}L${px+ux+sn*3},${py+uy+cs*3}`,stroke:C.blue,fill:'none','stroke-width':1.5}));
        }
        const hr=(A+R)/2;
        svg.append(sv('circle',{cx:x,cy:y,r:hr,stroke:C.green,'stroke-width':1.5,'stroke-dasharray':'5 4',fill:'none'}),sv('path',{d:`M${x+3},${y-hr-4}L${x-4},${y-hr}L${x+3},${y-hr+4}`,stroke:C.green,'stroke-width':1.6,fill:'none'}));
        svg.append(sv('circle',{cx:x,cy:y,r:A,fill:C.orange}),sv('text',{x:x,y:y+4,'text-anchor':'middle',style:'fill:var(--mw-paper)'},'a'),sv('text',{x:x+R+9,y:y+5},'b'),sv('text',{x:x,y:252,'text-anchor':'middle'},`a=${(a*1e3).toFixed(3)} mm；b=${outer.get().toFixed(1)} mm`));
        const ch=plot(right,'径向电场沿间隙的变化',[0,1],[0,1.1],'r / b','E(r) / E(a)',[0,.5,1],[0,.5,1]);
        ch.path(sample(1/r,1,180,x=>1/(r*x)),C.blue);ch.dot(1/r,1,C.orange);ch.line(1/r,0,1/r,1,C.orange,'4 3');
        read.textContent=`Zc=${z.toFixed(2)} Ω；αc=${alphaDb.toFixed(3)} dB/m；V峰上限=${v.toFixed(0)} V，P上限=${(p/1000).toFixed(2)} kW；高阶截止估算 ${(fc/1e9).toFixed(2)} GHz。${f>=fc?'当前频率达到估算高阶截止，不能再保证仅有 TEM。':''}`;
      };
      const choose=r=>{ratio.input.step='any';ratio.set(r);draw();};
      button(actions,'30 Ω：功率最优',()=>choose(Math.sqrt(Math.E)));button(actions,'50 Ω',()=>choose(Math.exp(50/60)));button(actions,'约 77 Ω：导体损耗最小',()=>choose(3.591121476668622));button(actions,'外半径 1 mm',()=>{outer.set(1);draw();});button(actions,'复位',()=>{ratio.input.step='.01';ratio.set(2.3);outer.set(2);freq.set(5);draw();});
    } else if(kind==='microstrip'){
      title.textContent='微带线：线宽改变后，阻抗与电长度一起更新';
      const width=control(controls,'宽高比 W/h',.2,4,.02,2,v=>v.toFixed(4));
      const er=control(controls,'基片相对介电常数 εr',2,10,.1,4.4,v=>v.toFixed(1));
      const height=control(controls,'基片厚度 h',.2,1.6,.1,.8,v=>`${v.toFixed(1)} mm`);
      const freq=control(controls,'频率 f',.5,8,.1,2,v=>`${v.toFixed(1)} GHz`);
      let fixedLength=null;
      note.textContent='沿用 4.7 的薄导体准静态近似；场线仅示意，未数值求解真实场。点击 50/100 Ω 设计时固定该段标称 90° 物理长度；再改线宽即可观察相移误差。h/λ0 只提示相对尺度，本演示不提供任意基片通用的有效性阈值。';
      draw=()=>{
        const p=width.get(),eps=er.get(),h=height.get(),f=freq.get(),m=microstrip(p,eps),W=p*h,l90=75/(f*Math.sqrt(m.ee));
        const {svg,w}=frame(left,'微带截面：空气与基片共同参与');const y=119,ground=207,strip=Math.min((w-45)*.75,22*p),x=w/2;
        svg.append(sv('rect',{x:15,y,width:w-30,height:ground-y,fill:C.green,opacity:.12}),sv('line',{x1:15,y1:ground,x2:w-15,y2:ground,stroke:C.ink,'stroke-width':5}),sv('line',{x1:x-strip/2,y1:y,x2:x+strip/2,y2:y,stroke:C.orange,'stroke-width':5}));
        for(const sign of [-1,1])for(const factor of [.35,.7,1]){
          const sx=x+sign*strip*.36,tx=x+sign*(strip/2+(w/2-strip/2-25)*factor),bend=y-20-24*factor;
          svg.append(sv('path',{d:`M${sx},${y-3} Q${tx},${bend} ${tx},${ground-4}`,fill:'none',stroke:C.blue,'stroke-width':1.3,opacity:.85}));
        }
        svg.append(sv('path',{d:`M${x},${y+3}L${x},${ground-4}`,stroke:C.blue,'stroke-width':1.3}),sv('text',{x:18,y:61},'空气 εr = 1'),sv('text',{x:18,y:184},`基片 εr = ${eps.toFixed(1)}`),sv('text',{x:x,y:100,'text-anchor':'middle'},`W = ${W.toFixed(3)} mm`),sv('text',{x:w-18,y:150,'text-anchor':'end'},`h = ${h.toFixed(1)} mm`),sv('text',{x:x,y:252,'text-anchor':'middle'},'导体厚度在计算中取零'));
        const top=Math.ceil(microstrip(.2,eps).z/20)*20;
        const ch=plot(right,'同一基片：宽高比与阻抗',[.2,4],[0,top],'W / h','Zc / Ω',[.2,1,2,3,4],[0,top/2,top]);
        ch.path(sample(.2,4,241,x=>microstrip(x,eps).z),C.green);ch.dot(p,m.z,C.orange);ch.line(.2,50,4,50,C.grid,'4 4');ch.line(.2,100,4,100,C.grid,'4 4');
        const theta=fixedLength===null?'':`；标称段长度固定 ${fixedLength.toFixed(3)} mm，当前相移 ${(90*fixedLength/l90).toFixed(3)}°`;
        read.textContent=`εeff=${m.ee.toFixed(5)}；Zc=${m.z.toFixed(3)} Ω；W=${W.toFixed(3)} mm，当前 90° 长度=${l90.toFixed(3)} mm；h/λ0=${(h*f/300).toFixed(4)}${theta}。`;
      };
      const choose=z=>{er.set(4.4);height.set(.8);freq.set(2);width.input.step='any';width.set(widthFor(z,4.4));fixedLength=75/(2*Math.sqrt(microstrip(width.get(),4.4).ee));draw();};
      const tolerance=delta=>{if(fixedLength===null)fixedLength=75/(freq.get()*Math.sqrt(microstrip(width.get(),er.get()).ee));width.input.step='any';width.set(Math.min(4,Math.max(.2,width.get()+delta/height.get())));draw();};
      button(actions,'50 Ω 设计',()=>choose(50));button(actions,'100 Ω 设计',()=>choose(100));button(actions,'线宽 −0.05 mm',()=>tolerance(-.05));button(actions,'线宽 +0.05 mm',()=>tolerance(.05));button(actions,'复位',()=>{width.input.step='.02';width.set(2);er.set(4.4);height.set(.8);freq.set(2);fixedLength=null;draw();});
    } else return;
    controls.addEventListener('input',()=>draw());draw();
    let last=0;const observer=new ResizeObserver(entries=>{const w=Math.round(entries[0].contentRect.width);if(w!==last){last=w;draw();}});observer.observe(panels);
  }
  function start(){document.querySelectorAll('[data-mw-demo="circular"],[data-mw-demo="coax"],[data-mw-demo="microstrip"]').forEach(root=>{if(!root.id)root.id=`mw-part4-demo-${++counter}`;init(root);});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
