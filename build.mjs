import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('vendor',{recursive:true});
for(const [source,target] of [['build/three.module.js','three.module.js'],['build/three.core.js','three.core.js'],['examples/jsm/controls/OrbitControls.js','OrbitControls.js'],['LICENSE','THREE-LICENSE.txt']])await copyFile(`node_modules/three/${source}`,`vendor/${target}`);
await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','app.js','scene.js','data.js','feed.js'])await copyFile(file,`dist/${file}`);
await cp('vendor','dist/vendor',{recursive:true});
console.log('Built static app in dist/ (including local Three.js).');
