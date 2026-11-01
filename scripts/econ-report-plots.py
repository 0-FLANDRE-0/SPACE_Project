"""Standalone offline SVG figures, generated with Matplotlib."""
import json,sys
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
out=Path(sys.argv[1]); series=json.loads((out/"series.json").read_text())
dest=out/"charts"; dest.mkdir(exist_ok=True)
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":9,"axes.titlesize":10,"svg.fonttype":"none","axes.spines.top":False,"axes.spines.right":False})
colors=["#2563eb","#059669","#ca8a04","#e11d48","#9333ea","#475569"]
charts=[
 ("gdp","Annual GDP (million C)",[("realGDP","real",1e6),("nominalGDP","nominal",1e6)]),
 ("cpi","Price index (start = 1)",[("priceIndex","CPI",1)]),
 ("alloy-real","Real alloy price (C/U)",[("realAlloyPrice","real",1)]),
 ("alloy-nominal","Nominal alloy price (C/U)",[("nominalAlloyPrice","nominal",1)]),
 ("budget","Annual discretionary budget (thousand C)",[("annualBudgetC","budget",1000)]),
 ("supply","Alloy supply (thousand U/month)",[("privateSupplyU","private",1000),("governmentSupplyU","state",1000)]),
 ("treasury","Treasury / debt (million C)",[("treasuryC","treasury",1e6),("debtC","debt",1e6)])]
expected={c["id"]+"-"+name+".svg" for c in series for name,_,_ in charts}
for old in dest.glob("*.svg"):
 if old.name not in expected and "ECON-SIM-1 / Matplotlib" in old.read_text():
  old.unlink()
for candidate in series:
 for name,title,fields in charts:
  plt.rcParams["svg.hashsalt"]=candidate["id"]+"-"+name
  fig,ax=plt.subplots(figsize=(4.15,2.75),layout="constrained")
  for (scenario,rows),color in zip(candidate["scenarios"].items(),colors):
   for i,(key,label,unit) in enumerate(fields):
    start=1 if key in ["privateSupplyU","governmentSupplyU"] else 0
    ax.plot([r["month"]/12 for r in rows[start:]],[r[key]/unit for r in rows[start:]],color=color,linestyle="--" if i else "-",linewidth=1.2,label=scenario+(" "+label if len(fields)>1 else ""))
  ax.axvspan(4,6,color="#fee2e2",alpha=.35,zorder=-1); ax.set_title(title,loc="left"); ax.set_xlabel("Years"); ax.set_xlim(0,20); ax.set_xticks([0,5,10,15,20]); ax.grid(alpha=.18)
  ax.yaxis.set_major_formatter(FuncFormatter(lambda x,pos:format(x,",.2f").rstrip("0").rstrip(".")))
  ax.legend(loc="upper left",bbox_to_anchor=(0,-.27),ncol=3,fontsize=6.3,frameon=False,handlelength=1.8,columnspacing=.8)
  target=dest/(candidate["id"]+"-"+name+".svg")
  fig.savefig(target,metadata={"Date":None,"Creator":"ECON-SIM-1 / Matplotlib"}); plt.close(fig)
  target.write_text("\n".join(line.rstrip() for line in target.read_text().splitlines())+"\n")
print("Saved",len(series)*len(charts),"standalone Matplotlib SVG charts")
