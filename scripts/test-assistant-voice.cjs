const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
const states=[],refs=[],effects=[],timers=new Map();
let stateIndex=0,refIndex=0,mounted=false,voice,transcript='',lastRecognition,spoken,cancels=0;
const react={
 useState(initial){const i=stateIndex++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=value;}];},
 useRef(initial){const i=refIndex++;return refs[i]|| (refs[i]={current:initial});},
 useEffect(fn){if(!mounted)effects.push(fn());}
};
class Recognition {
 start(){lastRecognition=this;this.started=true;}
 stop(){this.stopped=true;}
 abort(){this.aborted=true;}
}
const listeners=new Map();
const document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
const local={lang:'it-IT',localService:true},remote={lang:'it-IT',localService:false};
const window={webkitSpeechRecognition:Recognition,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{getVoices:()=>[remote,local],speak:u=>{spoken=u;},cancel:()=>cancels++}};
const exportsObject={};
vm.runInNewContext(ts.transpileModule(readFileSync('app/components/use-assistant-voice.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require:()=>react,window,document,SpeechSynthesisUtterance:window.SpeechSynthesisUtterance,setTimeout:(fn,ms)=>{const id={};timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
function render(){stateIndex=0;refIndex=0;voice=exportsObject.useAssistantVoice(text=>{transcript=text;});mounted=true;}
render();render();assert.equal(voice.available,true);assert.equal(voice.readAvailable,true);
voice.startListening('Già scritto');render();assert.equal(voice.listening,true);assert.equal(lastRecognition.lang,'it-IT');assert.equal(lastRecognition.continuous,false);
const first=lastRecognition,stale=first.onresult;
first.onresult({results:[[{transcript:'contratti'}]]});assert.equal(transcript,'Già scritto contratti');
first.onresult({results:[[{transcript:'contratti nel'}],[{transcript:'2025'}]]});assert.equal(transcript,'Già scritto contratti nel 2025');
voice.stopListening();assert.equal(first.stopped,true);assert.ok([...timers.values()].some(t=>t.ms===3000));
first.onend();render();assert.equal(voice.listening,false);assert.equal(timers.size,0);
voice.startListening('');render();const second=lastRecognition;
stale({results:[[{transcript:'risultato vecchio'}]]});assert.equal(transcript,'Già scritto contratti nel 2025');
second.onresult({results:[[{transcript:'a'.repeat(650)}]]});assert.equal(transcript.length,600);
second.onerror({error:'not-allowed'});render();assert.equal(voice.listening,false);assert.match(voice.notice,/non autorizzato/);assert.equal(second.aborted,true);
// Permission/service errors without onend unlock the microphone; backgrounding cancels both channels.
voice.startListening('');render();const third=lastRecognition;
voice.read(1,'2025. 389 contratti. Dati parziali.');render();assert.equal(third.aborted,true);assert.equal(voice.speaking,1);assert.equal(spoken.text,'2025. 389 contratti. Dati parziali.');assert.equal(spoken.voice,local);
const staleAudioEnd=spoken.onend;
voice.read(2,'2024. Non ho dati sufficienti.');render();staleAudioEnd();render();assert.equal(voice.speaking,2);
voice.read(2,'2024. Non ho dati sufficienti.');render();assert.equal(voice.speaking,null);assert.ok(cancels>=2);
voice.startListening('');render();document.hidden=true;listeners.get('visibilitychange')();render();assert.equal(voice.listening,false);assert.equal(lastRecognition.aborted,true);assert.equal(timers.size,0);
voice.startListening('');render();effects.forEach(cleanup=>cleanup?.());assert.equal(lastRecognition.aborted,true);assert.equal(listeners.size,0);assert.equal(timers.size,0);
delete window.webkitSpeechRecognition;render();voice.startListening('');render();assert.match(voice.notice,/non supporta/);
console.log('Assistant voice lifecycle checks passed');
