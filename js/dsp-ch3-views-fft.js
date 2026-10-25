/* SVG teaching views. Shared controller owns playback; rendering is pure in step. */
(function (root) {
  'use strict';
  const views=root.DSPCh3Views=root.DSPCh3Views||{};
  const F=root.DSPFFT;
  const NS='http://www.w3.org/2000/svg';
  const C={blue:'var(--dsp-blue, #2875a3)',teal:'var(--dsp-teal, #087f74)',orange:'var(--dsp-orange, #b45b18)',ink:'var(--dsp-ink, #273642)',muted:'var(--dsp-muted, #687782)',grid:'var(--dsp-grid, #cbd6dc)',paper:'var(--dsp-paper, #fffdf9)'};
  const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  const svg=(tag,attrs,text)=>{const node=document.createElementNS(NS,tag);Object.entries(attrs||{}).forEach(([k,v])=>node.setAttribute(k,String(v)));if(text!==undefined)node.textContent=text;return node;};
  const txt=(x,y,text,size=15,color=C.ink,anchor='middle')=>svg('text',{x,y,'font-size':size,fill:color,'text-anchor':anchor,'font-family':'inherit'},text);
  const binary=(n,bits)=>n.toString(2).padStart(bits,'0');
  const arrayText=(M,values)=>'['+values.map(v=>M.fmt(v,3)).join(', ')+']';
  const option=(value,label)=>{const node=el('option',label);node.value=value;return node;};
  function select(label,kind,choices,controls){
    const wrapper=el('label',undefined,'dsp-ch3-control');wrapper.append(el('span',label));
    const field=el('select');field.dataset.control=kind;choices.forEach(([value,text])=>field.append(option(value,text)));wrapper.append(field);controls.append(wrapper);return field;
  }
  function table(headers,rows){
    const wrap=el('div',undefined,'dsp-ch3-table'),t=el('table'),head=el('thead'),tr=el('tr');
    headers.forEach(h=>tr.append(el('th',h)));head.append(tr);t.append(head);const body=el('tbody');
    rows.forEach(row=>{const r=el('tr');row.forEach(v=>r.append(el('td',String(v))));body.append(r);});t.append(body);wrap.append(t);return wrap;
  }
  function presets(M,N,key){
    if(key==='exam')return [2,1,3,4];
    if(key==='exam-packed')return [M.cx(2,1),1,M.cx(0,2),M.cx(1,1)];
    if(key==='textbook')return N===4?[1,M.cx(0,2),0,0]:[4,-3,2,0,-1,-2,3,1];
    if(key==='impulse')return Array.from({length:N},(_,n)=>n===0?1:0);
    if(key==='r4')return Array.from({length:N},(_,n)=>n<4?1:0);
    if(key==='complex')return Array.from({length:N},(_,n)=>M.cx(n%3-1,(2*n+1)%4-1));
    return Array.from({length:N},(_,n)=>n+1);
  }
  function setupControls(api){
    const exam=api.root.dataset.exam==='true';
    const packed=api.root.dataset.profile==='ict-packed';
    const N=select('变换点数','N',exam?[['4','4 点（原题）']]:[['8','8 点'],['4','4 点']],api.controls);
    const preset=select('输入序列','preset',exam?[[packed?'exam-packed':'exam',packed?'信通卷五.2：z=h+jg':'未来卷一.7：x=[2,1,3,4]']]:[['textbook','教材例 3.11（8 点）'],['sequence','1, 2, …, N'],['r4','R₄：4 个 1，其余补零'],['impulse','单位冲激 δ[n]'],['complex','复序列（非平凡旋转）']],api.controls);
    if(exam){N.disabled=true;preset.disabled=true;}
    const update=()=>{if(!exam)preset.options[0].textContent=N.value==='4'?'教材例 3.10（4 点）':'教材例 3.11（8 点）';};
    api.listen(N,'change',()=>{update();api.changed();});api.listen(preset,'change',()=>api.changed());
    return {N,preset,input:()=>presets(api.M,Number(N.value),preset.value)};
  }
  function operations(trace){return trace.stages.flatMap((stage,s)=>stage.butterflies.map((butterfly,b)=>({s,b,stage,butterfly})));}
  function working(M,trace,done){
    const values=trace.initial.map(M.asComplex);
    operations(trace).slice(0,done).forEach(({butterfly:b})=>{values[b.i]=M.asComplex(b.top);values[b.j]=M.asComplex(b.bottom);});
    return values;
  }
  function flow(M,trace,done,selected,prefix){
    const N=trace.N,S=trace.stages.length,w=Math.max(750,200+S*190),h=110+N*58,x0=91,dx=(w-182)/S,y0=76,dy=58;
    const scene=svg('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':`${trace.mode.toUpperCase()} ${N}点FFT；可选择蝶形查看旧值与计算`});
    scene.style.minWidth=w+'px';scene.style.maxWidth='none';
    scene.append(svg('title',{},`${trace.mode.toUpperCase()} 分级蝶形流图`));
    const groups=operations(trace),completed=Math.max(0,Math.min(done,groups.length));
    trace.stages.forEach((stage,s)=>{
      const left=x0+s*dx,right=x0+(s+1)*dx;
      scene.append(txt((left+right)/2,24,`第 ${s+1} 级 · ${stage.span} 点组合`,14,C.ink));
      stage.butterflies.forEach((b,k)=>{
        const flat=s*(N/2)+k,isDone=flat<completed,isActive=selected&&selected.s===s&&selected.b===k;
        const color=isActive?C.orange:isDone?C.teal:C.grid;
        const g=svg('g',{'data-fft-stage':s,'data-fft-pair':k,'data-fft-prefix':prefix,tabindex:0,role:'button','aria-label':`第${s+1}级蝶形${k+1}，输入行${b.i}与${b.j}，旋转因子W_${N}^${b.r}`});
        [[b.i,b.i],[b.i,b.j],[b.j,b.i],[b.j,b.j]].forEach(([from,to])=>g.append(svg('line',{x1:left+49,y1:y0+from*dy,x2:right-49,y2:y0+to*dy,stroke:color,'stroke-width':isActive?3:1.35,opacity:isDone||isActive?1:.42})));
        if(isActive){
          const label=`W${N}^${b.r}`;g.append(svg('rect',{x:(left+right)/2-36,y:y0+b.j*dy-22,width:72,height:20,rx:4,fill:C.paper,stroke:C.orange}));
          g.append(txt((left+right)/2,y0+b.j*dy-7,label,12,C.orange));
        }
        scene.append(g);
      });
    });
    const snapshots=[trace.initial];
    trace.stages.forEach((stage,s)=>{
      const count=Math.max(0,Math.min(N/2,completed-s*N/2));
      if(count===0){snapshots.push(null);return;}
      const values=Array(N).fill(null);
      stage.butterflies.slice(0,count).forEach(b=>{values[b.i]=b.top;values[b.j]=b.bottom;});
      snapshots.push(values);
    });
    snapshots.forEach((values,col)=>{
      for(let row=0;row<N;row++){
        const x=x0+col*dx,y=y0+row*dy,isActive=selected&&col===selected.s+1&&(row===trace.stages[selected.s].butterflies[selected.b].i||row===trace.stages[selected.s].butterflies[selected.b].j);
        const box=svg('rect',{x:x-49,y:y-17,width:98,height:34,rx:5,fill:C.paper,stroke:isActive?C.orange:C.grid,'stroke-width':isActive?2:1});scene.append(box);
        const value=values&&values[row];
        scene.append(txt(x,y+5,value?M.fmt(value,2):'·',13,isActive?C.orange:value?C.ink:C.muted));
        if(col===0)scene.append(txt(x-57,y+5,trace.mode==='dit'?`x[${trace.order[row]}]`:`x[${row}]`,12,C.muted,'end'));
        if(col===S)scene.append(txt(x+56,y+5,trace.mode==='dit'?`X[${row}]`:`X[${trace.order[row]}]`,12,C.muted,'start'));
      }
    });
    scene.append(txt(w/2,h-12,trace.mode==='dit'?'本图采用：倒位序输入 → 自然序输出':'本图采用：自然序输入 → 倒位序存储；最终还原自然序',14,C.muted));
    const wrap=el('div',undefined,'dsp-ch3-flow');wrap.style.overflowX='auto';wrap.style.maxWidth='100%';wrap.append(scene);return wrap;
  }
  function complexPlane(M,b,mode){
    const base=mode==='dit'?b.b:M.sub(b.a,b.b),product=b.product,range=Math.max(1.35,M.abs(base)*1.25,M.abs(product)*1.25),w=330,h=270,cx=165,cy=135,scale=104/range;
    const scene=svg('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':'复平面中旋转因子与乘法前后的向量'});
    scene.style.minWidth=w+'px';scene.style.maxWidth='none';
    scene.append(svg('line',{x1:20,y1:cy,x2:310,y2:cy,stroke:C.grid}),svg('line',{x1:cx,y1:18,x2:cx,y2:250,stroke:C.grid}),svg('circle',{cx,cy,r:scale,fill:'none',stroke:C.grid,'stroke-dasharray':'4 4'}));
    scene.append(txt(307,cy-8,'Re',13,C.muted),txt(cx+13,23,'Im',13,C.muted),txt(cx+7,cy+17,'0',12,C.muted));
    const arrow=(z,label,color,labelOffset)=>{
      const x=cx+z.re*scale,y=cy-z.im*scale;
      scene.append(svg('line',{x1:cx,y1:cy,x2:x,y2:y,stroke:color,'stroke-width':2.4}),svg('circle',{cx:x,cy:y,r:4,fill:color}));
      scene.append(txt(Math.min(295,Math.max(35,x+labelOffset[0])),Math.min(253,Math.max(17,y+labelOffset[1])),label,14,color));
    };
    arrow(base,mode==='dit'?'b':'a − b',C.blue,[-13,-12]);arrow(product,mode==='dit'?'Wb':'(a − b)W',C.teal,[21,20]);arrow(b.twiddle,'W',C.orange,[18,-8]);
    const wrap=el('div',undefined,'dsp-ch3-flow');wrap.style.overflowX='auto';wrap.style.maxWidth='100%';wrap.append(scene);return wrap;
  }
  function showDetails(api,trace,operation){
    const {M}=api,b=operation.butterfly,mode=trace.mode;
    const wrap=el('div',undefined,'dsp-ch3-grid');wrap.style.gridTemplateColumns='repeat(auto-fit,minmax(min(100%,290px),1fr))';
    const numbers=el('div');numbers.append(el('strong',`第 ${operation.s+1} 级，行 ${b.i} 与 ${b.j}`));
    const lines=[`a = ${M.fmt(b.a)}；b = ${M.fmt(b.b)}`,`W_${trace.N}^${b.r} = ${M.fmt(b.twiddle,5)}`];
    if(mode==='dit')lines.push(`Wb = ${M.fmt(b.product)}`,`A = a + Wb = ${M.fmt(b.top)}`,`B = a − Wb = ${M.fmt(b.bottom)}`);
    else lines.push(`a − b = ${M.fmt(M.sub(b.a,b.b))}`,`A = a + b = ${M.fmt(b.top)}`,`B = (a − b)W = ${M.fmt(b.bottom)}`);
    lines.forEach(line=>numbers.append(el('p',line)));wrap.append(numbers,complexPlane(M,b,mode));api.formula.replaceChildren(wrap);
  }
  function resultTable(M,traces){
    const ref=M.dft(traces[0].input),headers=['k','直接 DFT'].concat(traces.map(t=>t.mode.toUpperCase()));
    const rows=ref.map((z,k)=>[k,M.fmt(z)].concat(traces.map(t=>M.fmt(t.output[k]))));
    const wrap=el('div');wrap.append(table(headers,rows));
    const err=traces.map(t=>`${t.mode.toUpperCase()} 最大绝对误差 ${M.maxError(t.output,ref).toExponential(2)}`).join('；');wrap.append(el('p',err));return wrap;
  }
  function recursiveGroups(N,depth){
    let groups=[Array.from({length:N},(_,n)=>n)];
    for(let d=0;d<depth;d++)groups=groups.flatMap(indices=>[indices.filter((_,i)=>i%2===0),indices.filter((_,i)=>i%2===1)]);
    return groups;
  }
  function decomposition(M,trace,depth){
    const N=trace.N,bits=Math.log2(N),w=790,h=125+bits*95;
    const scene=svg('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':'按局部偶数、奇数位置递归拆分输入'});scene.style.minWidth=w+'px';scene.style.maxWidth='none';
    for(let level=0;level<=bits;level++){
      const groups=recursiveGroups(N,level),active=level<=depth,y=57+level*95,dx=(w-60)/groups.length;
      groups.forEach((g,k)=>{
        const center=30+(k+.5)*dx,boxWidth=Math.min(dx-8,g.length===N?610:dx-13),label=g.map(n=>`x${n}`).join(', ');
        if(level>0){const parent=30+(Math.floor(k/2)+.5)*(w-60)/(groups.length/2);scene.append(svg('line',{x1:parent,y1:y-73,x2:center,y2:y-24,stroke:active?C.teal:C.grid,'stroke-width':active?2:1,opacity:active?1:.4}));}
        scene.append(svg('rect',{x:center-boxWidth/2,y:y-23,width:boxWidth,height:47,rx:5,fill:C.paper,stroke:active?C.teal:C.grid,'stroke-width':active?1.8:1}));
        scene.append(txt(center,y+5,active?label:'…',g.length===N?16:14,active?C.ink:C.muted));
        if(active&&g.length===1)scene.append(txt(center,y+42,M.fmt(trace.input[g[0]],2),13,C.blue));
      });
    }
    scene.append(txt(w/2,22,'每个子序列都按自己的局部位置分偶、分奇',16,C.ink));
    const wrap=el('div',undefined,'dsp-ch3-flow');wrap.style.overflowX='auto';wrap.append(scene);return wrap;
  }
  function orderTable(M,trace,current){
    const N=trace.N,bits=Math.log2(N),rows=trace.order.map((target,source)=>[source,binary(source,bits),binary(target,bits),target,M.fmt(trace.input[source])]);
    const wrap=el('div'),w=790,h=320,X=i=>66+i*(w-132)/(N-1),top=90,bottom=237;
    wrap.append(el('p',`当前把原样本 x[${current}] 移到工作位置 ${trace.order[current]}：${binary(current,bits)} → ${binary(trace.order[current],bits)}。每次只填入一个位置；下一步继续，后退则撤回。`));
    const scene=svg('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':`倒位序逐项映射，原编号${current}映到${trace.order[current]}`});scene.style.minWidth=w+'px';scene.style.maxWidth='none';
    scene.append(txt(20,25,'自然序输入',16,C.ink,'start'),txt(20,196,'倒位序工作数组',16,C.ink,'start'));
    for(let source=0;source<=current;source++){
      const target=trace.order[source],active=source===current;
      scene.append(svg('path',{d:`M ${X(source)} ${top+21} C ${X(source)} 151 ${X(target)} 165 ${X(target)} ${bottom-21}`,fill:'none',stroke:active?C.orange:C.grid,'stroke-width':active?3:1.4,opacity:active?1:.5}));
      scene.append(svg('path',{d:`M ${X(target)-5} ${bottom-29} L ${X(target)} ${bottom-21} L ${X(target)+5} ${bottom-29}`,fill:'none',stroke:active?C.orange:C.grid,'stroke-width':active?2.3:1.4}));
    }
    for(let i=0;i<N;i++){
      const source=trace.order[i],filled=source<=current;
      [[top,M.fmt(trace.input[i],2),i===current],[bottom,filled?M.fmt(trace.input[source],2):'·',i===trace.order[current]]].forEach(([y,value,active])=>{
        scene.append(svg('rect',{x:X(i)-38,y:y-21,width:76,height:42,rx:5,fill:C.paper,stroke:active?C.orange:C.grid,'stroke-width':active?2:1}),txt(X(i),y+5,value,14,active?C.orange:C.ink));
      });
      scene.append(txt(X(i),top-34,`${i} = ${binary(i,bits)}`,13,C.muted),txt(X(i),bottom+43,`${i} = ${binary(i,bits)}`,13,C.muted));
    }
    scene.append(txt(w/2,h-9,`最终工作数组的来源编号：${trace.order.join(', ')}`,15,C.muted));
    const flowWrap=el('div',undefined,'dsp-ch3-flow');flowWrap.style.overflowX='auto';flowWrap.append(scene);wrap.append(flowWrap);
    const mapping=table(['原编号 i','二进制','逐位反转','目标位置','移动的值'],rows),activeRow=mapping.querySelectorAll('tbody tr')[current];
    activeRow.style.outline='2px solid '+C.orange;activeRow.setAttribute('aria-current','step');wrap.append(mapping);return wrap;
  }
  function inspectControls(api,trace){
    const field=select('查看蝶形','butterfly',[['follow','跟随播放步骤']],api.controls);
    operations(trace).forEach((o,index)=>field.append(option(String(index),`第 ${o.s+1} 级：行 ${o.butterfly.i}、${o.butterfly.j}`)));
    return field;
  }
  views.fft=function(api){
    const {M}=api,params=setupControls(api);let trace=F.ditTrace(params.input()),ops=operations(trace),lastStep=0,selected=null;
    const inspect=inspectControls(api,trace);let signature='';
    const sync=()=>{
      const next=params.N.value+':'+params.preset.value;
      if(signature===next)return;signature=next;trace=F.ditTrace(params.input());ops=operations(trace);selected=null;
      inspect.replaceChildren(option('follow','跟随播放步骤'));ops.forEach((o,i)=>inspect.append(option(String(i),`第 ${o.s+1} 级：行 ${o.butterfly.i}、${o.butterfly.j}`)));
    };
    const show=step=>{
      sync();lastStep=Math.max(0,Math.min(step,Math.log2(trace.N)+trace.N+1+ops.length));const bits=Math.log2(trace.N),start=bits+trace.N+1;
      api.canvas.replaceChildren();api.formula.replaceChildren();api.result.replaceChildren();
      if(lastStep<=bits){
        api.canvas.append(decomposition(M,trace,lastStep));
        api.formula.textContent=lastStep===0?'x[n] → 偶编号 x[2m] 与奇编号 x[2m + 1]':`当前分解深度 ${lastStep}：`+recursiveGroups(trace.N,lastStep).map(g=>'['+g.join(', ')+']').join('；');
        api.explain.textContent=lastStep===0?'开始时保留自然顺序。下一步从每个子序列的局部编号中分出偶数项、奇数项。':'每拆一层，子变换点数减半。拆到单点时得到倒位序；这里展示的是适合迭代原位运算的一种实现安排。';
        api.result.textContent='输入 x = '+arrayText(M,trace.input);return;
      }
      if(lastStep<start){const current=lastStep-bits-1;api.canvas.append(orderTable(M,trace,current));api.formula.textContent=`${bits} 位二进制倒序：work[reverseBits(i)] ← x[i]；当前 i = ${current}`;
        api.explain.textContent=(bits===3?'例如 3 的三位二进制是 011，倒序为 110，即目标位置 6。':'例如 1 的两位二进制是 01，倒序为 10，即目标位置 2。')+'倒位序不是额外的DFT数学定义，而是本图迭代实现的存储安排。';api.result.textContent='已填入的工作数组 = ['+trace.order.map(source=>source<=current?M.fmt(trace.input[source]):'·').join(', ')+']';return;}
      const done=Math.min(ops.length,Math.max(0,lastStep-start+1)),current=done?ops[done-1]:ops[0];
      let active=selected!==null?ops[selected]:current;
      if(inspect.value!=='follow')active=ops[Number(inspect.value)]||current;
      api.canvas.append(flow(M,trace,done,active,'fft'));
      showDetails(api,trace,active);
      api.explain.textContent=`${done}/${ops.length} 个蝶形已执行。当前级采用跨度 ${current.stage.span}；旋转先作用于下支路，再计算 a ± Wb。可用“查看蝶形”或选中连线复查旧值。`;
      if(lastStep>=start+ops.length){api.result.append(resultTable(M,[trace]));api.explain.textContent='各级蝶形完成，自然顺序输出与直接DFT逐项比较。误差来自浮点舍入，不是两种变换定义不同。';}
      else api.result.textContent='自然序最终输出会在最后一步与直接 DFT 对照。';
    };
    api.listen(inspect,'change',()=>{if(api.pause)api.pause();selected=null;show(lastStep);});
    const pick=event=>{
      const target=event.target.closest('[data-fft-prefix="fft"]');if(!target)return;
      if(api.pause)api.pause();const s=Number(target.dataset.fftStage),b=Number(target.dataset.fftPair),index=s*trace.N/2+b;
      if(selected===index){showDetails(api,trace,ops[index]);return;}
      selected=index;inspect.value=String(selected);show(lastStep);
      const replacement=api.canvas.querySelector(`[data-fft-prefix="fft"][data-fft-stage="${s}"][data-fft-pair="${b}"]`);
      if(replacement)replacement.focus({preventScroll:true});
    };
    api.listen(api.canvas,'click',pick);api.listen(api.canvas,'focusin',pick);
    api.listen(api.canvas,'keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.closest('[data-fft-prefix="fft"]')){event.preventDefault();pick(event);}});
    return {steps:()=>{sync();return Math.log2(trace.N)+trace.N+2+ops.length;},render:show,reset:()=>{selected=null;inspect.value='follow';}};
  };
  function smallButterfly(M,trace,op){
    const b=op.butterfly,w=350,h=240,left=35,right=315,y1=65,y2=175,mode=trace.mode;
    const scene=svg('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':`${mode.toUpperCase()}蝶形：${mode==='dit'?'先乘旋转因子再和差':'先和差，再在差支路乘旋转因子'}`});scene.style.width='100%';scene.style.height='auto';
    const line=(x1,a,x2,c,color=C.grid)=>scene.append(svg('line',{x1,y1:a,x2,y2:c,stroke:color,'stroke-width':2}));
    const split=mode==='dit'?133:80,merge=mode==='dit'?260:200;
    line(left,y1,split,y1);line(left,y2,split,y2);
    [[y1,y1],[y1,y2],[y2,y1],[y2,y2]].forEach(([a,c])=>line(split,a,merge,c));
    line(merge,y1,right,y1);line(merge,y2,right,y2);
    scene.append(txt(left,y1-22,'a',15),txt(left,y2+30,'b',15),txt(right,y1-22,'A',15),txt(right,y2+30,'B',15));
    [y1,y2].forEach((y,k)=>scene.append(svg('circle',{cx:merge,cy:y,r:16,fill:C.paper,stroke:C.blue,'stroke-width':1.7}),txt(merge,y+5,k?'−':'+',17,C.blue)));
    const wx=mode==='dit'?85:260,wy=y2;scene.append(svg('circle',{cx:wx,cy:wy,r:21,fill:C.paper,stroke:C.orange,'stroke-width':2}),txt(wx,wy+5,'×W',14,C.orange));
    scene.append(txt(w/2,22,`W_${trace.N}^${b.r} = ${M.fmt(b.twiddle,3)}`,14,C.orange));
    scene.append(txt(w/2,h-7,mode==='dit'?'A = a + Wb；B = a − Wb':'A = a + b；B = (a − b)W',14,C.ink));return scene;
  }
  views.compare=function(api){
    const {M}=api,params=setupControls(api);let dit,dif,opsD,opsF,signature='';
    const sync=()=>{const next=params.N.value+':'+params.preset.value;if(next===signature)return;signature=next;const input=params.input();dit=F.ditTrace(input);dif=F.difTrace(input);opsD=operations(dit);opsF=operations(dif);};
    const show=step=>{
      sync();const done=Math.max(0,Math.min(opsD.length,step-1)),idx=Math.max(0,done-1),a=opsD[idx],b=opsF[idx];
      api.canvas.replaceChildren();api.formula.replaceChildren();api.result.replaceChildren();
      const grid=el('div',undefined,'dsp-ch3-grid');grid.style.gridTemplateColumns='repeat(auto-fit,minmax(min(100%,310px),1fr))';
      [[dit,a,'DIT：先旋转，再和差'],[dif,b,'DIF：先和差，再旋转']].forEach(([trace,op,title])=>{
        const section=el('section');section.append(el('h4',title));section.append(smallButterfly(M,trace,op));
        section.append(el('p',step<2?`初始工作数组 ${arrayText(M,trace.initial)}`:`第 ${op.s+1} 级，跨度 ${op.stage.span}；行 ${op.butterfly.i} 与 ${op.butterfly.j}`));
        if(step>=2){const v=op.butterfly;section.append(el('p',`a = ${M.fmt(v.a)}；b = ${M.fmt(v.b)}`),el('p',trace.mode==='dit'?`Wb = ${M.fmt(v.product)}`:`a − b = ${M.fmt(M.sub(v.a,v.b))}；(a − b)W = ${M.fmt(v.product)}`),el('p',`A = ${M.fmt(v.top)}；B = ${M.fmt(v.bottom)}`));}
        if(step<opsD.length+2)section.append(el('p',`当前工作数组（${done? '中间值':'初始值'}）：`),table(['存储行','数值'],working(M,trace,done).map((v,i)=>[i,M.fmt(v)])));
        grid.append(section);
      });api.canvas.append(grid);
      api.formula.textContent=step<2?`同一输入 x = ${arrayText(M,dit.input)}`:`同步进度 ${done}/${opsD.length}：DIT跨度由小到大，DIF跨度由大到小。两侧同编号步骤通常不是同一对输入值。`;
      api.explain.textContent='这里对照两种典型的迭代原位实现：DIT倒位序输入、自然序输出；DIF自然序输入、倒位序存储。递归实现或额外重排可采用别的外部位序，不能把本图当作所有FFT的限制。';
      if(step>=opsD.length+2){
        api.result.append(el('p','DIT 最终存储（自然序）= '+arrayText(M,dit.storage)),el('p','DIF 最终存储（倒位序）= '+arrayText(M,dif.storage)),el('p','DIF 重排：X[k] = storage[reverseBits(k)]，映射 '+dif.order.join(', ')),resultTable(M,[dit,dif]));
      }else api.result.textContent=step===0?'先观察旋转因子位于哪条支路，再逐步执行同一输入的两个算法。':`DIT初始编号：${dit.order.join(', ')}；DIF初始编号：${dit.input.map((_,i)=>i).join(', ')}。最终步骤将同时比较两者与直接DFT。`;
    };
    return {steps:()=>{sync();return opsD.length+3;},render:show};
  };
  views.examFft=api=>views.compare(api);
  views.examPacked=api=>views.fft(api);
})(typeof globalThis!=='undefined'?globalThis:this);
