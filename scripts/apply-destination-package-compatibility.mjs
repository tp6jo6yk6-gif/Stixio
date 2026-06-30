import { readFile, writeFile } from 'node:fs/promises';

const profilePath = 'src/core/destination-profiles.js';
const appPath = 'src/ui/stixio-workshop-app-v2.js';

let profiles = await readFile(profilePath, 'utf8');
let app = await readFile(appPath, 'utf8');

profiles = profiles.replace(
  "const name = `${String(prefix || '').trim()}${prefix ? '_' : ''}${String(index).padStart(3, '0')}${suffix ? `_${String(suffix).trim()}` : ''}.${extension}`;",
  "const name = `${String(prefix || '').trim()}${prefix ? '_' : ''}${String(index)}${suffix ? `_${String(suffix).trim()}` : ''}.${extension}`;"
);

const oldAssignment = `        const required=[];
        profile.roles.filter(role=>role.key!==fallback).forEach(role=>{const count=role.exact??(role.required?1:0);for(let i=0;i<count;i++)required.push(role.key);});
        const minimumSticker=profile.roles.find(role=>role.key===fallback)?.min||1;
        if(mode==='auto'&&selected.length<required.length+minimumSticker){window.alert(\`此 Profile 至少需要 \${required.length+minimumSticker} 張輸出。\`);return false;}
        const selectedIds=new Set(selected.map(frame=>frame.id));`;

const newAssignment = `        const required=[],optional=[];
        profile.roles.filter(role=>role.key!==fallback).forEach(role=>{
          const count=role.exact??(role.required?Math.max(1,role.min||1):0);
          for(let i=0;i<count;i++)required.push(role.key);
          if(!count&&(role.max==null||role.max>0))optional.push(role.key);
        });
        const minimumSticker=profile.roles.find(role=>role.key===fallback)?.min||1;
        if(mode==='auto'&&selected.length<required.length+minimumSticker){window.alert(\`此 Profile 至少需要 \${required.length+minimumSticker} 張輸出。\`);return false;}
        const optionalCapacity=Math.max(0,selected.length-required.length-minimumSticker);
        const assignments=mode==='auto'?[...required,...optional.slice(0,optionalCapacity)]:[];
        const selectedIds=new Set(selected.map(frame=>frame.id));`;

if (!app.includes(oldAssignment)) throw new Error('Missing Destination role assignment target.');
app = app.replace(oldAssignment, newAssignment);
app = app.replace(
  "const role=mode==='auto'?(required[index]||fallback):fallback;",
  "const role=mode==='auto'?(assignments[index]||fallback):fallback;"
);

await Promise.all([
  writeFile(profilePath, profiles, 'utf8'),
  writeFile(appPath, app, 'utf8')
]);
console.log('Destination Package compatibility applied.');
