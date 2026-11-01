"""Deterministic standalone scientific SVGs; no network or game mutation."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
ROOT=Path('docs/econ-sim/round3'); OUT=ROOT/'charts'; OUT.mkdir(exist_ok=True)
def read(n): return json.loads((ROOT/n).read_text())
S=read('series.json'); F=read('financial.json'); PAIR=read('paired-experiments.json'); REF=read('reference-series.json'); FIN=read('final-runs.json'); SEN=read('sensitivity.json')
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.titlesize':12,'axes.labelsize':10,'figure.facecolor':'#0d1524','axes.facecolor':'#101d30','savefig.facecolor':'#0d1524','text.color':'#e6edf8','axes.labelcolor':'#ccd6e8','xtick.color':'#adbbcf','ytick.color':'#adbbcf','axes.edgecolor':'#50627c','grid.color':'#304057','grid.alpha':.45,'legend.facecolor':'#142238','legend.edgecolor':'#43536c','svg.hashsalt':'SPACE-ECON3-2026-11-01','lines.linewidth':1.7})
COL=['#58c5ee','#f9bf67','#a799ff','#67d9ab','#fc8998','#b1c3d9']
files=[]
def save(name,fig):
 fig.tight_layout(pad=1.6);fig.savefig(OUT/(name+'.svg'),metadata={'Date':None,'Creator':'SPACE_Project ECON-SIM-3 / Matplotlib'});plt.close(fig);svg=OUT/(name+'.svg');svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n');files.append(name)
def axes(n=1,height=None):
 f,a=plt.subplots(n,1,figsize=(9,height or 2.6*n),squeeze=False)
 for ax in a.flat: ax.grid();ax.set_axisbelow(True)
 return f,a[:,0]
def arr(sc,fn): return np.array([fn(r) for r in S[sc]])
def x(sc): return arr(sc,lambda r:r['month']/12)
def flow(sc,key,planet='earth'): return arr(sc,lambda r:np.nan if r['month']==0 else r['planets'][planet]['flow'][key])
def body(sc,key,planet='earth'): return arr(sc,lambda r:np.nan if r['month']==0 and key=='reserveFraction' else r['planets'][planet][key])
def lines(ax,scs,fn,label,scale=1):
 for i,sc in enumerate(scs): ax.plot(x(sc),arr(sc,fn)/scale,label=sc,color=COL[i%len(COL)])
 ax.set_ylabel(label);ax.legend(ncol=min(4,len(scs)),fontsize=8);ax.set_xlabel('Year')

f,a=axes(3);scs=['E0','E1','E3','E5']
lines(a[0],scs,lambda r:r['realGDP'],'Real GDP (million C/year)',1e6)
lines(a[1],scs,lambda r:r['realAlloyPrice'],'Real alloy price (C/U)');a[1].axhspan(2.3*.85,2.3*1.15,color=COL[3],alpha=.08);a[1].axhline(2.3,color='#fff',ls=':',lw=.8)
lines(a[2],scs,lambda r:r['priceIndex'],'CPI (initial = 1)');save('01-macro',f)
f,a=axes(2)
lines(a[0],['S0','S2','S3-debt','S3-money'],lambda r:r['treasuryC'],'Treasury (million C)',1e6)
lines(a[1],['S0','S2','S3-debt','S3-money'],lambda r:r['debtC'],'Bonds outstanding (thousand C)',1000);save('02-fiscal',f)
f,a=axes(3)
for sc,c in [('E0',COL[0]),('E3',COL[1])]:
 a[0].plot(x(sc),flow(sc,'demandGWh')/730/1000,label=sc+' demand',c=c);a[0].plot(x(sc),flow(sc,'generationGWh')/730/1000,'--',label=sc+' available',c=c)
 a[1].plot(x(sc),flow(sc,'unservedGWh')/np.maximum(1,flow(sc,'demandGWh'))*100,label=sc,c=c)
 a[2].plot(x(sc),body(sc,'reserveFraction')*100,label=sc,c=c)
for ax,lab in zip(a,['Monthly average / available (TW)','Unserved electricity (%)','Energy reserve (%)']): ax.set_ylabel(lab);ax.legend(fontsize=8,ncol=2);ax.set_xlabel('Year')
save('03-grid',f)
f,a=axes(2)
for sc,c in [('E0',COL[0]),('E3',COL[1]),('E5',COL[4])]: a[0].plot(x(sc),flow(sc,'producedU')/1000,label=sc,c=c);a[1].plot(x(sc),body(sc,'industryUtilization')*100,label=sc,c=c)
for ax,lab in zip(a,['Alloy production (thousand U/month)','Industrial electrical utilization (%)']): ax.set_ylabel(lab);ax.legend(ncol=3);ax.set_xlabel('Year')
save('04-industry',f)
f,a=axes(2)
for id,c in [('moon',COL[0]),('mars',COL[1])]:
 for sc,ls in [('E2','-'),('E8','--')]: a[0].plot(x(sc),flow(sc,'unservedGWh',id)/np.maximum(1,flow(sc,'demandGWh',id))*100,label=sc+' '+id,c=c,ls=ls);a[1].plot(x(sc),body(sc,'storageGWh',id),label=sc+' '+id,c=c,ls=ls)
for ax,lab in zip(a,['Colonial unserved electricity (%)','Storage closing SOC (GWh)']): ax.set_ylabel(lab);ax.legend(ncol=2,fontsize=8);ax.set_xlabel('Year')
save('05-colonies',f)
f,a=axes(3)
for sc,c in [('E0',COL[0]),('E1',COL[1]),('E4',COL[4])]: a[0].plot(x(sc),arr(sc,lambda r:r['hydrogenPrice']),label=sc+' market',c=c)
a[0].plot(x('E0'),body('E0','hydrogenUnitCostC'),'--',color=COL[3],label='E0 full new-plant cost');a[0].axhline(.4,color='#fff',ls=':',label='0.4 reference')
for key,c in [('hydrogenByproductU',COL[1]),('hydrogenElectrolysisU',COL[0])]: a[1].plot(x('E1'),flow('E1',key),label=key,c=c)
a[2].plot(x('E1'),flow('E1','hydrogenUsedU')-flow('E1','normalHydrogenU')-flow('E1','startHydrogenU'),label='smelting',c=COL[0]);a[2].plot(x('E1'),flow('E1','normalHydrogenU'),label='normal fusion',c=COL[1]);a[2].plot(x('E1'),flow('E1','startHydrogenU'),label='startup',c=COL[4])
for ax,lab in zip(a,['Real hydrogen C/U','H production (U/month), E1','H consumption (U/month), E1']): ax.set_ylabel(lab);ax.legend(ncol=2,fontsize=8);ax.set_xlabel('Year')
save('06-hydrogen',f)
f,a=axes(2)
for key,c in [('governmentIndustryDirectC',COL[0]),('governmentPowerDirectC',COL[1])]: a[0].plot(x('E1'),flow('E1',key),label=key,c=c)
for key,c in [('governmentIndustryUpkeepU',COL[0]),('governmentPowerUpkeepU',COL[1])]: a[1].plot(x('E1'),flow('E1',key),label=key,c=c)
for ax,lab in zip(a,['Direct wages/admin (C/month)','Actual alloy upkeep (U/month)']): ax.set_ylabel(lab);ax.legend(fontsize=8);ax.set_xlabel('Year')
save('07-government-costs',f)
f,a=axes(2)
for key,c in [('governmentIndustryDirectC',COL[0]),('governmentPowerDirectC',COL[1])]: a[0].plot(x('E6'),flow('E6',key),label=key,c=c)
for key,c in [('governmentIndustryUpkeepU',COL[0]),('governmentPowerUpkeepU',COL[1])]: a[1].plot(x('E6'),flow('E6',key),label=key,c=c)
for ax,lab in zip(a,['Direct C/month','Alloy upkeep U/month']): ax.axvspan(4,5,color=COL[4],alpha=.12,label='paused / cold');ax.set_xlim(3,6.5);ax.set_ylabel(lab);ax.legend(fontsize=8);ax.set_xlabel('Year')
save('08-paused',f)
f,a=axes(2)
for sc,c in [('E0',COL[0]),('E5',COL[4])]: a[0].plot(x(sc),flow(sc,'healthMin'),label=sc,c=c);a[1].plot(x(sc),flow(sc,'upkeepPaidU')/np.maximum(.001,flow(sc,'upkeepRequiredU'))*100,label=sc,c=c)
for ax,lab in zip(a,['Minimum facility health (0-1)','Upkeep paid / required (%)']): ax.set_ylabel(lab);ax.legend();ax.set_xlabel('Year')
save('09-maintenance-crisis',f)
f,a=axes(2);h=np.linspace(0,96,385);r=np.maximum(0,h-24);p_in=np.where(h<=24,1.25,1.25*(96-h)/72);p_out=5*r/72
a[0].plot(h,p_in,label='External input (GW)',c=COL[1]);a[0].plot(h,p_out,label='Generated output (GW)',c=COL[0]);a[0].set_ylabel('Power (GW)');a[0].legend()
a[1].plot(h,1.25*np.minimum(h,24)+1.25*(r-r*r/144),label='Input75 GWh',c=COL[1]);a[1].plot(h,5*r*r/144,label='Output180 GWh',c=COL[0]);a[1].set_ylabel('Cumulative energy (GWh)');a[1].legend()
for ax in a: ax.set_xlabel('Progressed startup hours (not wall hours when starved)');ax.axvline(24,ls=':',c='#fff',lw=.7)
save('10-startup',f)
f,a=axes(2);names=['Fusion','Fission','Solar'];pos=np.arange(3);w=.34
for rows,label,offset,c in [(F['generationSingle'],'One module + full base',-w/2,COL[1]),(F['generationMaximum'],'Maximum modules + shared base',w/2,COL[0])]:
 a[0].bar(pos+offset,[r['annualNetC']/r['modules'] for r in rows],w,label=label,color=c)
 vals=[r['cashPaybackYears'] or 0 for r in rows];a[1].bar(pos+offset,vals,w,label=label,color=c)
 for i,r in enumerate(rows):
  if r['cashPaybackYears'] is None: a[1].text(i+offset,1,'No positive\nannual net',ha='center',fontsize=7,color=c)
for ax,lab in zip(a,['Annual net / module (C), purchased inputs','Simple recovery (years), not social benefit']): ax.set_xticks(pos,names);ax.set_ylabel(lab);ax.legend(fontsize=8)
save('11-power-finance',f)
f,a=axes(2);fuel=[.5,1,2.5]
for scenario,c in [('E1',COL[0]),('E4',COL[1])]:
 rs=[[r for r in PAIR if r['experiment']=='fusion-fuel' and r['scenario']==scenario and r['fuel']==v] for v in fuel]
 a[0].plot(fuel,[np.mean([r['meanHydrogenPrice'] for r in ss]) for ss in rs],'-o',label=scenario+' market',c=c)
 a[0].plot(fuel,[np.mean([r['meanHydrogenCostC'] for r in ss]) for ss in rs],'--',label=scenario+' new H cost',c=c)
 a[1].plot(fuel,[np.mean([r['planetSummary']['earth']['normalHydrogenU'] for r in ss]) for ss in rs],'-o',label=scenario,c=c)
for ax,lab in zip(a,['Mean real hydrogen price / cost (C/U)','Earth20-year normal fusion H (U)']): ax.set_ylabel(lab);ax.set_xlabel('SENSITIVITY ONLY: H U/month per full module');ax.legend(fontsize=8)
save('12-fuel-sensitivity',f)
f,a=axes(2);mix=['steelHeavy','mixed','nonferrousHeavy'];xx=np.arange(3)
for scenario,c in [('E0',COL[0]),('E3',COL[1])]:
 rr=[[r for r in PAIR if r['experiment']=='metal-mix' and r['scenario']==scenario and r['industryMix']==m] for m in mix]
 a[0].plot(xx,[np.mean([r['meanRealAlloyPrice'] for r in s]) for s in rr],'-o',c=c,label=scenario)
 a[1].plot(xx,[np.mean([r['earthUnservedFraction']*100 for r in s]) for s in rr],'-o',c=c,label=scenario)
for ax,lab in zip(a,['Mean alloy C/U (five seeds)','Earth unserved electricity (%)']): ax.set_xticks(xx,['Steel-heavy\n2.025 MWh/t','Mixed\n3.575 MWh/t','Nonferrous-heavy\n5.900 MWh/t']);ax.set_ylabel(lab);ax.legend()
save('13-metal-mixes',f)
f,a=axes(1,5);top=SEN[:10];a[0].barh([r['parameter'] for r in top][::-1],[r['score'] for r in top][::-1],color=COL[0]);a[0].set_xlabel('OAT |price delta|/2.3 + |Earth delta| + |colony delta|');a[0].set_title('Sensitivity ranking: normalized score, not causal attribution');save('14-oat',f)
f,a=axes(2)
for ax,planet,demand in zip(a,['moon','mars'],[.8,.2]):
 rows=[r for r in F['colonySizing'] if r['planet']==planet and r['kwPerPerson']==4];p=np.arange(3)
 ax.bar(p-.18,[r['ratedGW'] for r in rows],.36,label='Fixed nameplate',color=COL[0]);ax.bar(p+.18,[r['averageGW'] for r in rows],.36,label='Assumed average',color=COL[1]);ax.axhline(demand,label='4kW/person demand',ls='--',color=COL[4]);ax.set_xticks(p,names);ax.set_ylabel(planet+' power (GW)');ax.legend(fontsize=8)
save('15-colony-sizing',f)
f,a=axes(2);inf=read('infrastructure-value.json')['rows']
for i,scenario in enumerate(['E1','E3']):
 rr=[r for r in inf if r['scenario']==scenario];a[0].bar(i,np.mean([r['avoidedUnservedGWh'] for r in rr])/1000,color=COL[i]);a[1].bar(i,np.mean([r['cumulativeRealGDPDifferenceC'] for r in rr]),color=COL[i])
for ax,lab in zip(a,['20-year unserved energy avoided (TWh)','Cumulative real GDP loss avoided (C,20years)']): ax.set_xticks([0,1],['E1','E3']);ax.set_ylabel(lab)
a[1].set_title('Avoided losses are NOT electricity sales revenue');save('16-infrastructure',f)
f,a=axes(2);a[0].plot(x('E7'),flow('E7','constructionC')/1000,c=COL[1]);a[0].set_ylabel('Paid construction (thousand C/month)');a[1].plot(x('E7'),body('E7','activePowerModules'),label='Active / curtailed',c=COL[0]);a[1].plot(x('E7'),body('E7','starting'),label='Starting',c=COL[4]);a[1].set_ylabel('Earth modules');a[1].legend();a[1].set_xlabel('Year');save('17-parallel-build',f)
f,a=axes(2)
for sc,c in [('S3-debt',COL[0]),('S3-money',COL[1])]:
 a[0].plot(x(sc),arr(sc,lambda r:r['realAlloyPrice']/2.3-1)*100,label=sc,c=c)
 rr=S[sc];yy=[r['month']/12 for r in rr[12:]];a[1].plot(yy,[(rr[i]['priceIndex']/rr[i-12]['priceIndex']-1)*100 for i in range(12,len(rr))],label=sc,c=c)
a[0].axhspan(20,60,color=COL[4],alpha=.1,label='Legacy peak target20-60%')
for ax,lab in zip(a,['Real alloy change from2.3 (%)','Rolling12-month inflation (%)']): ax.set_ylabel(lab);ax.legend(fontsize=8);ax.set_xlabel('Year')
save('18-war',f)
f,a=axes(2)
for mode,c in [('OFF',COL[1]),('ON',COL[0])]:
 rr=REF[mode+':S0'];xx=[r['month']/12 for r in rr];a[0].plot(xx,[r['realAlloyPrice'] for r in rr],label=mode,c=c);a[1].plot(xx,[r['treasuryC']/1e6 for r in rr],label=mode,c=c)
for ax,lab in zip(a,['Legacy rounded-4: real alloy C/U','Treasury (million C)']): ax.set_ylabel(lab);ax.legend();ax.set_xlabel('Year')
save('19-legacy-off-on',f)
f,a=axes(2)
for sc,c in [('S1',COL[0]),('S1-sell',COL[1])]:
 a[0].plot(x(sc),body(sc,'privateSets'),label=sc,c=c);a[1].plot(x(sc),arr(sc,lambda r:r['realAlloyPrice']),label=sc,c=c)
for ax,lab in zip(a,['Private smelter-equivalent sets','Real alloy price C/U']): ax.set_ylabel(lab);ax.legend();ax.set_xlabel('Year')
save('20-government-selling',f)
B=read('broad-candidates.json');f,a=axes(1,5)
xx=[r['perScenario']['E0']['hydrogenCostC'] for r in B]; yy=[r['perScenario']['E0']['meanHydrogenPrice'] for r in B]
a[0].scatter(xx,yy,s=10,c=[COL[3] if y>=x else COL[4] for x,y in zip(xx,yy)],alpha=.55);lim=max(max(xx),max(yy));a[0].plot([0,lim],[0,lim],':',c='#fff',label='Market = full new capacity cost');a[0].axhline(.4,c=COL[1],ls='--',label='0.4 reference');a[0].set_xlabel('New electrolysis full cost C/U (broad512)');a[0].set_ylabel('E0 mean market C/U, five seeds');a[0].legend(fontsize=8);save('21-hydrogen-feasibility',f)
(ROOT/'chart-index.json').write_text(json.dumps(files,indent=2)+'\n');print(f'{len(files)} standalone SVG charts generated')
