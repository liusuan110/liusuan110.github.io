/* Small, dependency-free mathematical models shared by the chapter 3 views. */
(function (root, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DSPMath=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const cx=(re=0,im=0)=>({re:Number(re),im:Number(im)});
  const asComplex=v=>typeof v==='number'?cx(v,0):cx(v.re,v.im);
  const add=(a,b)=>{a=asComplex(a);b=asComplex(b);return cx(a.re+b.re,a.im+b.im)};
  const sub=(a,b)=>{a=asComplex(a);b=asComplex(b);return cx(a.re-b.re,a.im-b.im)};
  const mul=(a,b)=>{a=asComplex(a);b=asComplex(b);return cx(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re)};
  const scale=(a,s)=>{a=asComplex(a);return cx(a.re*s,a.im*s)};
  const conj=a=>{a=asComplex(a);return cx(a.re,-a.im)};
  const abs=a=>{a=asComplex(a);return Math.hypot(a.re,a.im)};
  const mod=(n,N)=>((n%N)+N)%N;
  const positive=(n,label)=>{if(!Number.isInteger(n)||n<1)throw new RangeError(label+' must be a positive integer');return n};
  const vector=x=>{if(!Array.isArray(x)||!x.length)throw new RangeError('Sequence must not be empty');return x.map(v=>{const z=asComplex(v);if(!Number.isFinite(z.re)||!Number.isFinite(z.im))throw new RangeError('Samples must be finite');return z})};
  const real=x=>{vector(x);if(x.some(v=>typeof v!=='number'))throw new RangeError('This convolution view uses real sequences');return x.slice()};
  const clean=(v,digits=3)=>Math.abs(v)<0.5*Math.pow(10,-digits)?0:v;
  const fmt=(value,digits=3)=>{
    const z=asComplex(value),a=Number(clean(z.re,digits).toFixed(digits)),b=Number(clean(z.im,digits).toFixed(digits));
    const f=v=>Number(v.toFixed(digits)).toString();
    if(!b)return f(a);if(!a)return (b===-1?'-':b===1?'':f(b))+'j';
    return f(a)+(b<0?' − ':' + ')+(Math.abs(b)===1?'':f(Math.abs(b)))+'j';
  };
  const twiddle=(N,r)=>{positive(N,'N');const a=-2*Math.PI*r/N;return cx(Math.cos(a),Math.sin(a))};
  function dtft(input,omega){return vector(input).reduce((s,x,n)=>add(s,mul(x,cx(Math.cos(-omega*n),Math.sin(-omega*n)))) ,cx())}
  function dft(input){const x=vector(input),N=x.length;return Array.from({length:N},(_,k)=>x.reduce((s,v,n)=>add(s,mul(v,twiddle(N,k*n))),cx()))}
  function idft(input){const X=vector(input),N=X.length;return dft(X.map(conj)).map(z=>scale(conj(z),1/N))}
  function pad(input,N){positive(N,'N');if(input.length>N)throw new RangeError('Padding length must cover the input');return input.concat(Array.from({length:N-input.length},()=>0))}
  function linearConvolution(input,filter){const x=real(input),h=real(filter),out=Array(x.length+h.length-1).fill(0);x.forEach((a,n)=>h.forEach((b,k)=>{out[n+k]+=a*b}));return out}
  function circularConvolution(input,filter,N){positive(N,'N');const x=real(input),h=real(filter),out=Array(N).fill(0);x.forEach((a,n)=>h.forEach((b,k)=>{out[mod(n+k,N)]+=a*b}));return out}
  function frequencyConvolution(input,filter,N){
    const X=dft(pad(real(input),N)),H=dft(pad(real(filter),N));
    return idft(X.map((z,k)=>mul(z,H[k]))).map(z=>z.re);
  }
  function olaTrace(input,filter,B,N){
    const x=real(input),h=real(filter);positive(B,'B');positive(N,'N');
    if(N<B+h.length-1)throw new RangeError('OLA needs N >= B + Lh - 1');
    const output=Array(x.length+h.length-1).fill(0),blocks=[];
    for(let start=0,index=0;start<x.length;start+=B,index++){
      const fresh=pad(x.slice(start,start+B),B),block=pad(fresh,N);
      const circular=frequencyConvolution(block,h,N),linear=linearConvolution(fresh,h);
      linear.forEach((v,k)=>{if(start+k<output.length)output[start+k]+=v});
      blocks.push({index,start,input:block,fresh,linear,circular,kept:linear.slice(),discard:[],partial:output.slice()});
    }
    return {B,N,Lh:h.length,output,blocks};
  }
  function olsTrace(input,filter,N){
    const x=real(input),h=real(filter);positive(N,'N');if(N<h.length)throw new RangeError('OLS needs N >= Lh');
    const B=N-h.length+1,output=Array(x.length+h.length-1).fill(0),blocks=[];
    for(let start=0,index=0;start<output.length;start+=B,index++){
      const block=Array.from({length:N},(_,m)=>{const n=start-(h.length-1)+m;return n>=0&&n<x.length?x[n]:0});
      const circular=frequencyConvolution(block,h,N),kept=circular.slice(h.length-1),discard=circular.slice(0,h.length-1);
      kept.forEach((v,k)=>{if(start+k<output.length)output[start+k]=v});
      blocks.push({index,start,input:block,circular,kept,discard,partial:output.slice()});
    }
    return {B,N,Lh:h.length,output,blocks};
  }
  function complexity(N){
    positive(N,'N');if(!Number.isInteger(Math.log2(N)))throw new RangeError('Radix 2 requires a power of two');
    return {N,dftMultiplications:N*N,dftAdditions:N*(N-1),stages:Math.log2(N),butterflies:N/2*Math.log2(N),fftMultiplications:N/2*Math.log2(N),fftAdditions:N*Math.log2(N)};
  }
  function maxError(a,b){if(a.length!==b.length)throw new RangeError('Different lengths');return Math.max(0,...a.map((v,k)=>abs(sub(v,b[k]))))}
  return {cx,asComplex,add,sub,mul,scale,conj,abs,mod,fmt,twiddle,vector,dtft,dft,idft,pad,linearConvolution,circularConvolution,frequencyConvolution,olaTrace,olsTrace,complexity,maxError};
});
