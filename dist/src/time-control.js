export const BASE_GAME_SECONDS_PER_REAL_SECOND=10;
export const TIME_SPEEDS=Object.freeze([.1,.25,.5,.75,1,2,5,10,50,100]);
export class TimeControl {
  requestedSpeed=1;speedCap=null;paused=false;
  get effectiveSpeed(){return Math.min(this.requestedSpeed,this.speedCap??100);}
  setRequestedSpeed(value){if(!TIME_SPEEDS.includes(value))throw new Error('허용 배속은 0.1×–100× 프리셋입니다.');this.requestedSpeed=value;}
  setSpeedCap(value){if(value!==null&&(!Number.isFinite(value)||value<.1||value>100))throw new Error('배속 상한은 0.1–100 또는 null이어야 합니다.');this.speedCap=value;}
  gameSecondsFor(realSeconds){return !this.paused&&Number.isFinite(realSeconds)&&realSeconds>=0?realSeconds*BASE_GAME_SECONDS_PER_REAL_SECOND*this.effectiveSpeed:0;}
}
// A monotonic foreground clock: normal render stalls are counted in full. A
// >=60 s gap without a visibility event is treated as suspension, not offline time.
export class ForegroundClock {
  constructor(now=0,visible=true){this.last=now;this.visible=visible;this.suspended=false;}
  setVisible(visible,now){this.visible=visible;this.last=now;this.suspended=false;}
  sample(now){const delta=(now-this.last)/1000;this.last=now;this.suspended=this.visible&&delta>=60;return this.visible&&delta>=0&&!this.suspended?delta:0;}
}
export function formatGameDate(epochISO,days){const date=new Date(Date.parse(epochISO)+days*86400000);return date.toISOString().slice(0,19).replaceAll('-','.').replace('T',' ');}
