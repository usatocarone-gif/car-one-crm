import type { AssistantResult } from "./schema";
import type { AssistantPresentation } from "./summary";
const BRANDS:[RegExp,string][]=[[/^(?:MERCEDES(?:[ -]BENZ)?)(?:\s|$)/,"Mercedes-Benz"],[/^(?:VW|VOLKSWAGEN)(?:\s|$)/,"Volkswagen"],[/^ALFA ROMEO(?:\s|$)/,"Alfa Romeo"],[/^LAND ROVER(?:\s|$)/,"Land Rover"],[/^CITRO[EË]N(?:\s|$)/,"Citroën"]];
const SIMPLE=["ABARTH","AUDI","BMW","CUPRA","DACIA","DR","FIAT","FORD","HONDA","HYUNDAI","JAGUAR","JEEP","KIA","LANCIA","LEXUS","LYNK & CO","MAZDA","MG","MINI","MITSUBISHI","NISSAN","OPEL","PEUGEOT","PORSCHE","RENAULT","SEAT","SKODA","SMART","SSANGYONG","SUBARU","SUZUKI","TESLA","TOYOTA","VOLVO"];
export function vehicleBrand(description:string){
  const text=description.trim().toUpperCase().replace(/\s+/g," ");
  for(const [pattern,label] of BRANDS)if(pattern.test(text))return label;
  const brand=SIMPLE.find(b=>text===b||text.startsWith(b+" "));
  return brand||"Non classificata";
}
export function presentVehicles(result:AssistantResult,partial:boolean):AssistantPresentation{
  const rows=result.rows,priced=rows.filter(r=>r.invoiceAmount!==undefined);
  const amounts=priced.map(r=>r.invoiceAmount!).sort((a,b)=>a-b);
  const sum=amounts.reduce((a,b)=>a+b,0),median=amounts.length?(amounts[Math.floor((amounts.length-1)/2)]+amounts[Math.floor(amounts.length/2)])/2:null;
  const money=(value:number|null)=>value===null?"n.d.":value.toLocaleString("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0});
  const provisional=(r:typeof rows[number])=>r.category.startsWith("Registrazioni provvisorie");
  const brands=[...new Set(rows.map(r=>vehicleBrand(r.vehicle||"")))].sort();
  const models=new Map<string,number>();for(const row of rows){const key=(row.vehicle||"Non indicato").trim().toUpperCase().replace(/\s+/g," ");models.set(key,(models.get(key)||0)+1);}
  const rankedModels=[...models].filter(([name])=>name!=="NON INDICATO").sort(([a,n],[b,m])=>m-n||a.localeCompare(b));
  const rankedBrands=brands.filter(b=>b!=="Non classificata").map(brand=>({brand,count:rows.filter(r=>vehicleBrand(r.vehicle||"")===brand).length})).sort((a,b)=>b.count-a.count||a.brand.localeCompare(b.brand));
  const bounds=[0,10000,15000,20000,25000,30000,40000,Infinity];
  const bands=bounds.slice(0,-1).map((min,i)=>[bounds[i+1]===Infinity?`Da ${money(min)}`:min===0?`Sotto ${money(bounds[i+1])}`:`Da ${money(min)} a meno di ${money(bounds[i+1])}`,String(amounts.filter(v=>v>=min&&v<bounds[i+1]).length)]);
  bands.push(["Importo assente, non valido o provvigione",String(rows.length-priced.length)]);
  return {
    title:`${rows.length} registrazioni di veicoli${partial?" valide lette":" venduti"}`,
    message:"Marche e modelli derivano dalla descrizione registrata. Il prezzo di riferimento concordato è IMP. FATT. dello storico. Valore vendita/provvigione del mese corrente escluso dagli importi. Non sono disponibili segmento, alimentazione, anno e chilometri del veicolo venduto; quelli della permuta non vengono attribuiti all’auto venduta.",
    metrics:[{label:"Marca più presente fra le classificate",value:rankedBrands.length?`${rankedBrands[0].brand} (${rankedBrands[0].count})`:"n.d."},{label:"Descrizione modello più frequente",value:rankedModels.length?`${rankedModels[0][0]} (${rankedModels[0][1]})`:"n.d."},{label:"Registrazioni ufficiali",value:String(rows.filter(r=>!provisional(r)).length)},{label:"Registrazioni provvisorie",value:String(rows.filter(provisional).length)},{label:"Con importo fattura valido",value:`${priced.length}/${rows.length}`},{label:"Prezzo medio · IMP. FATT. valorizzato",value:money(amounts.length?sum/amounts.length:null)},{label:"Prezzo mediano · IMP. FATT. valorizzato",value:money(median)}],partial,
    tables:[
      {title:"Marche registrate",columns:["Marca","Ufficiali","Provvisori","Con importo","Media IMP. FATT."],rows:brands.map(brand=>{const items=rows.filter(r=>vehicleBrand(r.vehicle||"")===brand),values=items.filter(r=>r.invoiceAmount!==undefined);return [brand,String(items.filter(r=>!provisional(r)).length),String(items.filter(provisional).length),String(values.length),money(values.length?values.reduce((s,r)=>s+r.invoiceAmount!,0)/values.length:null)];})},
      {title:"Top 20 descrizioni modello registrate",columns:["Descrizione nel foglio","Registrazioni"],rows:[...models].sort(([a,n],[b,m])=>m-n||a.localeCompare(b)).slice(0,20).map(([model,count])=>[model,String(count)])},
      {title:"Fasce di prezzo · IMP. FATT.",columns:["Fascia IMP. FATT.","Registrazioni"],rows:bands}
    ]
  };
}
