/* Radix-2 FFT models: each butterfly keeps its old values for reversible views. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dsp-ch3-math.js'));
  else root.DSPFFT = factory(root.DSPMath);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  'use strict';
  if (!M) throw new Error('DSPFFT requires DSPMath');
  const copy = values => values.map(M.asComplex);
  function length(N) {
    if (!Number.isInteger(N) || N < 1 || !Number.isInteger(Math.log2(N))) throw new RangeError('Radix 2 requires a nonempty power-of-two length');
    return Math.log2(N);
  }
  function bitReverseIndices(N) {
    const bits = length(N);
    return Array.from({length:N}, (_,n) => {
      let source=n, reversed=0;
      for(let b=0;b<bits;b++){reversed=reversed*2+source%2;source=Math.floor(source/2);}
      return reversed;
    });
  }
  function trace(input, mode) {
    const x=M.vector(input), N=x.length;
    length(N);
    const order=bitReverseIndices(N), initial=mode==='dit'?order.map(i=>M.asComplex(x[i])):copy(x);
    const work=copy(initial), stages=[];
    const spans=Array.from({length:Math.log2(N)},(_,i)=>mode==='dit'?2**(i+1):N/2**i);
    spans.forEach((span,index)=>{
      const before=copy(work), butterflies=[];
      for(let start=0;start<N;start+=span){
        for(let offset=0;offset<span/2;offset++){
          const i=start+offset,j=i+span/2,r=offset*N/span,twiddle=M.twiddle(N,r);
          const a=M.asComplex(work[i]),b=M.asComplex(work[j]);
          const product=mode==='dit'?M.mul(twiddle,b):M.mul(M.sub(a,b),twiddle);
          const top=mode==='dit'?M.add(a,product):M.add(a,b);
          const bottom=mode==='dit'?M.sub(a,product):M.asComplex(product);
          work[i]=M.asComplex(top);work[j]=M.asComplex(bottom);
          butterflies.push({index:butterflies.length,i,j,r,twiddle,a,b,product,top,bottom});
        }
      }
      stages.push({index,span,before,after:copy(work),butterflies});
    });
    const storage=copy(work), output=mode==='dit'?copy(storage):order.map(i=>M.asComplex(storage[i]));
    return {mode,N,input:copy(x),order,initial,stages,output,storage};
  }
  const ditTrace=x=>trace(x,'dit');
  const difTrace=x=>trace(x,'dif');
  const fft=x=>ditTrace(x).output;
  function ifft(input){const X=M.vector(input);return fft(X.map(M.conj)).map(z=>M.scale(M.conj(z),1/X.length));}
  return {bitReverseIndices,fft,ifft,ditTrace,difTrace};
});
