import * as THREE from 'three';
import {OrbitControls} from 'three/addons/OrbitControls.js';

export class RoomScene{
 constructor(host,{onSelect,onHover,reduced}){
  this.host=host;this.reduced=reduced;this.nodes=new Map();this.selected=null;this.neighbors=[];this.focus=null;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(38,1,.1,100);this.camera.position.set(8,5.2,10.8);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0xffffff,0);host.append(this.renderer.domElement);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.065;this.controls.minDistance=6;this.controls.maxDistance=27;this.controls.enablePan=false;this.controls.autoRotate=!reduced;this.controls.autoRotateSpeed=.35;this.controls.maxPolarAngle=Math.PI*.85;
  this.controls.addEventListener('start',()=>{this.focus=null;this.onHover(null)});
  this.scene.add(new THREE.AmbientLight(0xffffff,2.3));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,7,8);this.scene.add(light);
  // A restrained floor grid and faint verticals give the cloud depth, without implying meaningful axes.
  const grid=new THREE.GridHelper(12,12,0xdedee9,0xeaeaf1);grid.position.y=-3.5;grid.material.transparent=true;grid.material.opacity=.55;this.scene.add(grid);
  const box=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(10,7,10)),new THREE.LineBasicMaterial({color:0xe6e4f0,transparent:true,opacity:.45}));this.scene.add(box);
  this.geometry=new THREE.SphereGeometry(.135,24,16);
  this.halo=new THREE.Mesh(new THREE.SphereGeometry(.215,24,16),new THREE.MeshBasicMaterial({color:0x8b78db,transparent:true,opacity:.15,depthWrite:false}));this.halo.visible=false;this.scene.add(this.halo);
  const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(18),3));lineGeometry.setDrawRange(0,0);
  this.lines=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:0x9a8bb9,transparent:true,opacity:.48}));this.scene.add(this.lines);
  this.onHover=onHover;this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();let down;
  const hit=event=>{const rect=host.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);return this.raycaster.intersectObjects([...this.nodes.values()].map(n=>n.mesh))[0]?.object.userData.id};
  host.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY}});
  host.addEventListener('pointermove',event=>{if(event.buttons)return;const id=hit(event),r=host.getBoundingClientRect();host.style.cursor=id?'pointer':'grab';onHover(id,event.clientX-r.left,event.clientY-r.top)});
  host.addEventListener('pointerleave',()=>onHover(null));
  host.addEventListener('pointerup',event=>{if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<5){const id=hit(event);if(id)onSelect(id)}down=null;});
  host.addEventListener('pointercancel',()=>{down=null});
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  this.lastTime=performance.now();this.renderer.setAnimationLoop(time=>this.frame(time));
  this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.renderer.setAnimationLoop(null);const warning=document.createElement('p');warning.className='webgl-message';warning.textContent='The graphics connection was interrupted. Reload to restore 3D. Name search still works.';host.append(warning)});
 }
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false)}
 update(people,targets,getColor){
  const ids=new Set(people.map(p=>p.id));for(const [id,node] of this.nodes)if(!ids.has(id)){this.scene.remove(node.mesh);node.mesh.material.dispose();this.nodes.delete(id)}
  for(const person of people){let node=this.nodes.get(person.id);const target=new THREE.Vector3(...targets.get(person.id));if(!node){const mesh=new THREE.Mesh(this.geometry,new THREE.MeshStandardMaterial({color:getColor(person),roughness:.35,metalness:.05}));mesh.userData.id=person.id;mesh.position.copy(target).multiplyScalar(this.reduced?1:1.55);mesh.scale.setScalar(this.reduced?1:.01);this.scene.add(mesh);node={mesh,target,born:performance.now(),person};this.nodes.set(person.id,node)}node.person=person;node.target=target;node.mesh.material.color.set(getColor(person));if(this.reduced)node.mesh.position.copy(target);}
 }
 recolor(getColor){for(const node of this.nodes.values())node.mesh.material.color.set(getColor(node.person))}
 select(id,neighbors,focus){this.selected=id;this.neighbors=neighbors;const node=this.nodes.get(id);this.halo.visible=Boolean(node);if(node&&focus)this.focus=node.target.clone().multiplyScalar(.3);else if(!id)this.focus=new THREE.Vector3();}
 reset(){this.camera.position.set(8,5.2,10.8);this.controls.target.set(0,0,0);this.focus=null;this.controls.update()}
 toggleRotate(){this.controls.autoRotate=!this.controls.autoRotate;return this.controls.autoRotate}
 frame(time){
  if(document.hidden){this.lastTime=time;return}const dt=Math.min((time-this.lastTime)/1000,.05);this.lastTime=time;
  for(const [id,node] of this.nodes){node.mesh.position.lerp(node.target,this.reduced?1:1-Math.exp(-dt*4));const age=(time-node.born)/1000;const entrance=age<1?Math.min(1,age*1.8):1;const pulse=!this.reduced&&age<2?1+.45*Math.sin(Math.min(1,age/2)*Math.PI):1;const emphasis=id===this.selected?1.45:this.neighbors.includes(id)?1.18:1;node.mesh.scale.setScalar(this.reduced?emphasis:Math.max(.01,entrance)*pulse*emphasis);}
  const selected=this.nodes.get(this.selected);
  if(selected){this.halo.position.copy(selected.mesh.position);this.halo.scale.setScalar(1.1);const points=[];for(const id of this.neighbors){const n=this.nodes.get(id);if(n)points.push(selected.mesh.position,n.mesh.position)}const attribute=this.lines.geometry.getAttribute('position');points.forEach((p,i)=>attribute.setXYZ(i,p.x,p.y,p.z));attribute.needsUpdate=true;this.lines.geometry.setDrawRange(0,points.length);this.lines.geometry.computeBoundingSphere();this.lines.visible=true}else this.lines.visible=false;
  if(this.focus){this.controls.target.lerp(this.focus,this.reduced?1:1-Math.exp(-dt*3));if(this.controls.target.distanceTo(this.focus)<.001)this.focus=null}
  this.controls.update(dt);this.renderer.render(this.scene,this.camera);
 }
}
