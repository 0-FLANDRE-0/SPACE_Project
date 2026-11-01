"""ECON-SIM-2 offline SVG figures; no modification to round1 plots."""
import json,sys
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter
out=Path(sys.argv[1]); series=json.loads((out/"series.json").read_text()); results=json.loads((out/"results.json").read_text())
dest=out/"charts";dest.mkdir(exist_ok=True)
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":9,"axes.titlesize":10,"svg.fonttype":"none","axes.spines.top":False,"axes.spines.right":False})
colors=["#2563eb","#059669","#ca8a04","#e11d48","#9333ea","#475569","#0891b2"]
charts=[("gdp","Annual GDP (million C)",[("realGDP","real",1e6),("nominalGDP","nominal",1e6)]),
 ("cpi","Price index",[("priceIndex","CPI",1)]),
 ("alloy-real","Real alloy price (C/U)",[("realAlloyPrice","real",1)]),
 ("alloy-nominal","Nominal alloy price (C/U)",[("nominalAlloyPrice","nominal",1)]),
 ("budget","Annual budget (thousand C)",[("annualBudgetC","budget",1000)]),
 ("supply","Alloy supply (thousand U/month)",[("privateSupplyU","private",1000),("governmentSupplyU","state",1000)]),
 ("treasury","Treasury / debt (million C)",[("treasuryC","treasury",1e6),("debtC","debt",1e6)])]
def save(fig,name):
 target=dest/(name+".svg");fig.savefig(target,metadata={"Date":None,"Creator":"ECON-SIM-2 / Matplotlib"});plt.close(fig)
 target.write_text("\n".join(line.rstrip() for line in target.read_text().splitlines())+"\n")
for profile in series:
 for name,title,fields in charts:
  plt.rcParams["svg.hashsalt"]=profile["id"]+"-"+name
  fig,ax=plt.subplots(figsize=(4.2,3.0),layout="constrained")
  for (scenario,rows),color in zip(profile["scenarios"].items(),colors):
   for i,(key,label,unit) in enumerate(fields):
    start=1 if key in ["privateSupplyU","governmentSupplyU"] else 0
    ax.plot([r["month"]/12 for r in rows[start:]],[r[key]/unit for r in rows[start:]],color=color,linestyle="--" if i else "-",linewidth=1.1,label=scenario+(" "+label if len(fields)>1 else ""))
  ax.axvspan(4,6,color="#fee2e2",alpha=.4,zorder=-1);ax.set_title(title,loc="left");ax.set_xlabel("Years");ax.set_xlim(0,20);ax.set_xticks([0,5,10,15,20]);ax.grid(alpha=.18)
  ax.yaxis.set_major_formatter(FuncFormatter(lambda x,pos:format(x,",.2f").rstrip("0").rstrip(".")))
  ax.legend(loc="upper left",bbox_to_anchor=(0,-.25),ncol=3,fontsize=6.1,frameon=False,handlelength=1.7,columnspacing=.7)
  save(fig,profile["id"]+"-"+name)
 plt.rcParams["svg.hashsalt"]=profile["id"]+"-selling"
 fig,axes=plt.subplots(2,1,figsize=(4.2,4.4),layout="constrained")
 for scenario,color in [("S1","#2563eb"),("S1-sell","#059669")]:
  rows=profile["scenarios"][scenario]
  axes[0].plot([r["month"]/12 for r in rows],[r["realAlloyPrice"] for r in rows],color=color,label=scenario)
  axes[1].plot([r["month"]/12 for r in rows],[r["privateCapacityU"]/1000 for r in rows],color=color,label=scenario)
 for ax in axes:ax.set_xlim(0,20);ax.grid(alpha=.18);ax.legend(fontsize=8)
 axes[0].set_title("Selling: real alloy price (C/U)",loc="left");axes[1].set_title("Private capacity (thousand U/month)",loc="left");axes[1].set_xlabel("Years")
 save(fig,profile["id"]+"-selling")
data=results["equilibriumStudy"];prices=[d["equilibrium"] for d in data];means=[d["meanRealPrice"] for d in data]
plt.rcParams["svg.hashsalt"]="econ2-equilibrium-distribution"
fig,ax=plt.subplots(figsize=(4.2,2.8),layout="constrained");ax.hist(prices,bins=16,color="#2563eb",edgecolor="white");ax.axvline(2.3,color="#e11d48",linestyle="--");ax.set_title("Filtered equilibrium distribution",loc="left");ax.set_xlabel("Analytical investment threshold (C/U)");ax.set_ylabel("Profiles");save(fig,"equilibrium-distribution")
plt.rcParams["svg.hashsalt"]="econ2-equilibrium-v-mean"
fig,ax=plt.subplots(figsize=(4.2,3.2),layout="constrained")
for passed,color,label in [(False,"#94a3b8","Not passed"),(True,"#059669","All passed")]:
 rows=[d for d in data if d["passed"]==passed]
 if rows:ax.scatter([d["equilibrium"] for d in rows],[d["meanRealPrice"] for d in rows],s=10,alpha=.6,color=color,label=label)
ax.axhspan(2.3*.92,2.3*1.08,color="#dcfce7",alpha=.35);ax.plot([2.2,2.45],[2.2,2.45],"--",color="#e11d48",linewidth=1,label="y = x")
ax.set_title("Threshold vs S0 20-year mean",loc="left");ax.set_xlabel("Analytical threshold (C/U)");ax.set_ylabel("Real price mean, five seeds (C/U)");ax.grid(alpha=.15);ax.legend(fontsize=8);save(fig,"equilibrium-v-mean")
expected={p["id"]+"-"+name+".svg" for p in series for name in [*[c[0] for c in charts],"selling"]}|{"equilibrium-distribution.svg","equilibrium-v-mean.svg"}
for old in dest.glob("*.svg"):
 if old.name not in expected and "ECON-SIM-2 / Matplotlib" in old.read_text():old.unlink()
print("Saved",len(expected),"ECON-SIM-2 SVG figures")
