import {
auth,db,storage,
signInWithEmailAndPassword,
onAuthStateChanged,
signOut,
collection,addDoc,onSnapshot,query,orderBy,serverTimestamp,deleteDoc,doc,updateDoc,setDoc,
ref,uploadBytes,getDownloadURL
} from './firebase.js';

let currentUserEmail = null;
let replyText = "";

/* ---------------- LOGIN ---------------- */
window.login = async function(){
const email = document.getElementById('email').value;
const password = document.getElementById('password').value;

await signInWithEmailAndPassword(auth,email,password);
window.location='chat.html';
}

/* ---------------- ONLINE STATUS ---------------- */
onAuthStateChanged(auth, async (user)=>{
if(user){
currentUserEmail = user.email;

await setDoc(doc(db,"users",user.email),{
online:true,
lastSeen:Date.now(),
typing:false
},{merge:true});

// heartbeat
setInterval(()=>{
updateDoc(doc(db,"users",user.email),{
online:true,
lastSeen:Date.now()
});
},5000);
}
});

/* ---------------- OFFLINE ---------------- */
window.addEventListener("beforeunload", async ()=>{
if(currentUserEmail){
await updateDoc(doc(db,"users",currentUserEmail),{
online:false,
lastSeen:Date.now()
});
}
});

/* ---------------- SEND MESSAGE ---------------- */
window.sendMessage = async function(){
const input = document.getElementById('messageInput');
if(!input.value) return;

await addDoc(collection(db,'messages'),{
text:input.value,
sender:auth.currentUser.email,
reply:replyText,
seen:false,
time:serverTimestamp()
});

input.value="";
replyText="";
}

/* ---------------- LOAD CHAT ---------------- */
const q = query(collection(db,'messages'),orderBy('time'));

onSnapshot(q,(snap)=>{
const box=document.getElementById('messages');
if(!box) return;

box.innerHTML="";

snap.forEach((d)=>{
const data=d.data();

let div=document.createElement('div');

if(data.sender===auth.currentUser.email){
div.className="message me";
}else{
div.className="message other";
}

div.innerHTML=`
<b>${data.sender}</b><br>
${data.reply ? "↪ "+data.reply+"<br>" : ""}
${data.text || ""}
<br>
<small>${data.seen ? "✓✓ Seen" : "✓ Sent"}</small>
`;

box.appendChild(div);
});
});

/* ---------------- DELETE ---------------- */
window.delMsg=async function(id){
await deleteDoc(doc(db,'messages',id));
}

/* ---------------- REPLY ---------------- */
window.reply=function(text){
replyText=text;
document.getElementById('typing').innerText="Replying: "+text;
}

/* ---------------- TYPING ---------------- */
const input=document.getElementById('messageInput');

if(input){
input.addEventListener('input',()=>{
document.getElementById('typing').innerText="Typing...";

setTimeout(()=>{
document.getElementById('typing').innerText="";
},1000);
});
}

/* ---------------- VOICE MESSAGE ---------------- */
let recorder;
let chunks=[];

window.startRecording=async function(){
const stream=await navigator.mediaDevices.getUserMedia({audio:true});
recorder=new MediaRecorder(stream);
recorder.start();

recorder.ondataavailable=e=>chunks.push(e.data);

recorder.onstop=async()=>{
const blob=new Blob(chunks,{type:'audio/mp3'});
const r=ref(storage,'voice/'+Date.now());
await uploadBytes(r,blob);
const url=await getDownloadURL(r);

await addDoc(collection(db,'messages'),{
audio:url,
sender:auth.currentUser.email,
time:serverTimestamp()
});

chunks=[];
};

setTimeout(()=>recorder.stop(),5000);
}