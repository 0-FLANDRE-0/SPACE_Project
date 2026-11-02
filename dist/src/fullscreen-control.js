export class FullscreenControl {
 constructor(element,button,{notify,onResize=()=>{}}){this.element=element;this.button=button;this.notify=notify;this.onResize=onResize;this.pending=false;this.lastExit=-Infinity;this.abort=new AbortController();const options={signal:this.abort.signal};
  button.addEventListener('click',()=>this.toggle(),options);
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)this.lastExit=performance.now();this.sync();onResize();},options);
  document.addEventListener('fullscreenerror',()=>{this.notify('전체화면 요청이 거부되었습니다. 브라우저 메뉴 또는 홈 화면에 추가를 이용해 주세요.');this.sync();},options);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.fullscreenElement===this.element){e.stopImmediatePropagation();document.exitFullscreen().then(()=>this.sync(),()=>this.sync());}},{...options,capture:true});this.sync();
 }
 sync(){const active=document.fullscreenElement===this.element;this.button.setAttribute('aria-pressed',String(active));this.button.title=active?'전체화면 해제':'전체화면';this.button.setAttribute('aria-label',this.button.title);this.button.classList.toggle('active',active);}
 async toggle(){if(this.pending)return;this.pending=true;try{if(document.fullscreenElement===this.element)await document.exitFullscreen();else if(typeof this.element.requestFullscreen!=='function'||document.fullscreenEnabled===false){this.notify(typeof this.element.requestFullscreen!=='function'?'현재 브라우저에서는 전체화면을 지원하지 않습니다. 브라우저 메뉴 또는 홈 화면에 추가를 이용해 주세요.':'현재 페이지는 전체화면을 지원하지 않습니다 (브라우저/임베디드 권한 제한). 브라우저 메뉴 또는 홈 화면에 추가를 이용해 주세요.');return;}else await this.element.requestFullscreen();this.sync();this.onResize();}catch(error){this.notify('전체화면을 사용할 수 없습니다: '+error.message+' · 브라우저 메뉴 또는 홈 화면에 추가를 이용해 주세요.');this.sync();}finally{this.pending=false;}}
 dispose(){this.abort.abort();}
}
