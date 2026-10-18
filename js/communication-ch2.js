/* Chapter 2: analytic models, no external runtime or continuous animation. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const C = {blue:'#2274a5', teal:'#087f74', orange:'#b45b18', muted:'#64788a', grid:'#d9e4eb'};
  const el = (name, attrs = {}, text = '') => {
    const node = document.createElement(name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  };
  const sv = (name, attrs = {}, text = '') => {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  };
  function graph(host, title, xlim, ylim, xlabel, ylabel, ticksX, ticksY, square = false) {
    const width = Math.max(250, Math.floor(host.getBoundingClientRect().width));
    const height = square ? Math.min(width, 390) : 224;
    const margin = {l:47, r:18, t:29, b:37};
    let pw = width-margin.l-margin.r, ph = height-margin.t-margin.b;
    if (square) { const side = Math.min(pw,ph); margin.l += (pw-side)/2; pw=side; ph=side; }
    const X = x => margin.l + (x-xlim[0])/(xlim[1]-xlim[0])*pw;
    const Y = y => margin.t + ph - (y-ylim[0])/(ylim[1]-ylim[0])*ph;
    const svg = sv('svg', {viewBox:`0 0 ${width} ${height}`, role:'img', 'aria-label':title});
    svg.append(sv('title',{},title));
    svg.append(sv('text',{x:margin.l, y:17, class:'comm-ch2-plot-title'},title));
    const line = (x1,y1,x2,y2,color=C.grid,dash='') => {
      const n=sv('line',{x1:X(x1),y1:Y(y1),x2:X(x2),y2:Y(y2),stroke:color,'stroke-width':1});
      if(dash)n.setAttribute('stroke-dasharray',dash); svg.append(n); return n;
    };
    ticksX.forEach(v=>{ line(v,ylim[0],v,ylim[1]); svg.append(sv('text',{x:X(v),y:margin.t+ph+17,'text-anchor':'middle',class:'comm-ch2-tick'},String(v))); });
    ticksY.forEach(v=>{ line(xlim[0],v,xlim[1],v); svg.append(sv('text',{x:margin.l-8,y:Y(v)+4,'text-anchor':'end',class:'comm-ch2-tick'},String(v))); });
    if(xlim[0]<=0&&xlim[1]>=0)line(0,ylim[0],0,ylim[1],C.muted);
    if(ylim[0]<=0&&ylim[1]>=0)line(xlim[0],0,xlim[1],0,C.muted);
    svg.append(sv('text',{x:margin.l+pw,y:height-2,'text-anchor':'end',class:'comm-ch2-axis'},xlabel));
    svg.append(sv('text',{x:margin.l,y:margin.t+12,class:'comm-ch2-axis'},ylabel));
    host.replaceChildren(svg);
    const path = (points,color=C.blue,dash='')=>{
      const p=sv('path',{d:points.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(2)},${Y(y).toFixed(2)}`).join(' '),fill:'none',stroke:color,'stroke-width':2.3,'stroke-linejoin':'round'});
      if(dash)p.setAttribute('stroke-dasharray',dash); svg.append(p); return p;
    };
    const dot = (x,y,color=C.orange,r=4)=>svg.append(sv('circle',{cx:X(x),cy:Y(y),r,fill:color}));
    const fillRect=(x1,x2,y,color)=>svg.append(sv('rect',{x:X(x1),y:Y(y),width:X(x2)-X(x1),height:Y(0)-Y(y),fill:color,opacity:0.18}));
    const text=(x,y,value,color=C.blue,anchor='start')=>svg.append(sv('text',{x:X(x),y:Y(y),fill:color,'text-anchor':anchor,class:'comm-ch2-axis'},value));
    return {path,dot,line,fillRect,text};
  }
  const samples=(lo,hi,n,fn)=>Array.from({length:n},(_,i)=>{const x=lo+(hi-lo)*i/(n-1);return [x,fn(x)];});
  const sinc=x=>Math.abs(x)<1e-10?1:Math.sin(Math.PI*x)/(Math.PI*x);
  let count=0;
  function init(root) {
    if(root.dataset.ready)return; root.dataset.ready='true';
    const kind=root.dataset.demo;
    const settings={
      pulse:{title:'动手看：脉冲变窄，频谱怎样展开？',label:'脉冲宽度 T',min:0.25,max:2,step:0.05,value:1,unit:'ms'},
      correlation:{title:'动手看：滑动重叠怎样形成相关？',label:'相对错位 τ/T',min:-1.8,max:1.8,step:0.02,value:0.4,unit:''},
      iq:{title:'动手看：参考载波超前，星座向哪边转？',label:'本地载波相位 θ',min:-90,max:90,step:1,value:0,unit:'°'}
    };
    const s=settings[kind]; if(!s)return;
    const title=el('strong',{class:'comm-ch2-demo-title'},s.title);
    const controls=el('div',{class:'comm-ch2-controls'});
    const id=`comm-ch2-range-${++count}`;
    const label=el('label',{for:id},s.label);
    const range=el('input',{id,type:'range',min:s.min,max:s.max,step:s.step,value:s.value});
    const output=el('output',{for:id,class:'comm-ch2-value'});
    const reset=el('button',{type:'button',class:'comm-ch2-reset'},'复位');
    controls.append(label,output,range,reset);
    const charts=el('div',{class:'comm-ch2-charts'});
    const first=el('div',{class:'comm-ch2-chart'}); charts.append(first);
    let second;
    if(kind!=='iq'){second=el('div',{class:'comm-ch2-chart'}); charts.append(second);}
    const readout=el('p',{class:'comm-ch2-readout','aria-live':'polite','aria-atomic':'true'});
    const note=el('p',{class:'comm-ch2-demo-note'});
    root.replaceChildren(title,controls,charts,readout,note);
    function draw() {
      const value=Number(range.value);
      output.value=`${kind==='iq'?value:value.toFixed(2)} ${s.unit}`.trim();
      range.setAttribute('aria-valuetext',output.value);
      if(kind==='pulse') {
        const T=value;
        const a=graph(first,'时域：幅度固定为 1',[-2,2],[-0.08,1.35],'t / ms','x(t)',[-2,-1,0,1,2],[0,1]);
        a.path([[-2,0],[-T/2,0],[-T/2,1],[T/2,1],[T/2,0],[2,0]]);
        a.fillRect(-T/2,T/2,1,C.blue);
        const b=graph(second,'频域：双边幅度谱',[-4,4],[-0.08,2.35],'f / kHz','|X| / ms',[-4,-2,0,2,4],[0,1,2]);
        b.path(samples(-4,4,801,f=>T*Math.abs(sinc(f*T))));
        b.dot(-1/T,0);b.dot(1/T,0);
        readout.textContent=`X(0) = ${T.toFixed(2)} ms；首零点 ±${(1/T).toFixed(2)} kHz；主瓣双边跨度 ${(2/T).toFixed(2)} kHz。`;
        note.textContent='蓝线为解析公式 T·sinc(fT)，橙点为首零点。横轴窗口固定；窗口外仍有旁瓣，主瓣宽度不是严格带宽。固定幅度时，变窄也会使面积和能量下降。';
      } else if(kind==='correlation') {
        const tau=value, overlap=Math.max(0,1-Math.abs(tau));
        const a=graph(first,'固定 x(t)，滑动 x(t + τ)',[-2.5,2.5],[-0.08,1.35],'t / T','幅度',[-2,-1,0,1,2],[0,1]);
        a.path([[-2.5,0],[-0.5,0],[-0.5,1],[0.5,1],[0.5,0],[2.5,0]],C.blue,'5 3');
        a.path([[-2.5,0],[-tau-0.5,0],[-tau-0.5,1],[-tau+0.5,1],[-tau+0.5,0],[2.5,0]],C.teal);
        if(overlap>0)a.fillRect(Math.max(-0.5,-tau-0.5),Math.min(0.5,-tau+0.5),1,C.orange);
        const b=graph(second,'积分值：归一化能量自相关',[-2,2],[-0.08,1.35],'τ / T','Rᴱ(τ) / E',[-2,-1,0,1,2],[0,1]);
        b.path([[-2,0],[-1,0],[0,1],[1,0],[2,0]],C.blue);b.dot(tau,overlap);
        readout.textContent=`重叠长度 = ${overlap.toFixed(2)} T；Rᴱ(τ) / E = ${overlap.toFixed(2)}。`;
        note.textContent='蓝虚线为原脉冲，绿线为 x(t+τ)，橙色为乘积不为零的区间。τ 增大时，绿线向左移动；这里采用能量相关，没有除以观察时长。';
      } else {
        const theta=value*Math.PI/180;
        const I=Math.cos(theta)+Math.sin(theta), Q=Math.cos(theta)-Math.sin(theta);
        const g=graph(first,'固定发送坐标，观察接收 I/Q',[-1.8,1.8],[-1.8,1.8],'Iᵣ','Qᵣ',[-1,0,1],[-1,0,1],true);
        g.path(samples(0,2*Math.PI,151,t=>Math.sin(t)).map(([,y],i)=>[Math.sqrt(2)*Math.cos(2*Math.PI*i/150),Math.sqrt(2)*y]),C.grid,'3 3');
        [[1,1],[-1,1],[-1,-1],[1,-1]].forEach(([x,y])=>g.dot(x,y,C.muted,3));
        g.path([[0,0],[1,1]],C.muted,'5 3');g.path([[0,0],[I,Q]],C.teal);g.dot(I,Q,C.teal,5);
        g.path([[I,0],[I,Q],[0,Q]],C.orange,'3 3');
        const onBoundary=Math.abs(I)<1e-8||Math.abs(Q)<1e-8;
        const status=onBoundary?'落在判决边界':I>0&&Q>0?'仍在原象限':'已跨过原符号的判决边界';
        readout.textContent=`发送 (I,Q) = (1,1)；接收 (Iᵣ,Qᵣ) = (${I.toFixed(3)}, ${Q.toFixed(3)})；${status}。`;
        note.textContent='采用 2cos(ωct+θ) 与 −2sin(ωct+θ) 两条支路，接收复坐标为 (1+j)e⁻ʲᶿ。正 θ 使绿向量顺时针转，模长不变。图中无噪声、无频偏；实际系统还需载波同步。';
      }
    }
    let pending=false;
    const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;draw();});};
    range.addEventListener('input',schedule);
    reset.addEventListener('click',()=>{range.value=s.value;schedule();});
    if('ResizeObserver' in window)new ResizeObserver(schedule).observe(root);
    draw();
  }
  function start() {
    const roots=document.querySelectorAll('.comm-ch2-demo[data-demo]');
    // Three small SVG models are cheap to initialize together. Empty placeholders
    // stay hidden without JavaScript; observing hidden nodes would never reveal them.
    roots.forEach(init);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
