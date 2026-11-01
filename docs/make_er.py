import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

T = {  # name: (x, y, [(attr, flag)])   flag: PK / FK / ''
 "Users":      (12.6, 4.6, [("user_id","PK"),("full_name",""),("email (unique)",""),("password_hash (bcrypt)",""),("role  ADMIN|PATHOLOGIST|TECHNICIAN",""),("is_active",""),("reports_to","FK"),("created_at","")]),
 "Patients":   (0.3, 15.0, [("patient_id","PK"),("uhid (unique)",""),("full_name",""),("age",""),("gender",""),("contact","")]),
 "Cases":      (0.3, 9.6, [("case_id","PK"),("case_number (unique)",""),("patient_id","FK"),("status",""),("priority",""),("accessioned_at","")]),
 "Specimens":  (6.4, 15.0, [("specimen_id","PK"),("case_id","FK"),("organ_site",""),("biopsy_type",""),("fixation_type",""),("collection_date","")]),
 "Reports":    (6.4, 9.9, [("report_id","PK"),("case_id (unique)","FK"),("pathologist_id","FK"),("diagnosis / icd_code / category",""),("microscopic_findings",""),("synoptic_data  JSONB",""),("embedding  vector(384)",""),("is_signed / signed_at","")]),
 "IHC_Results":(18.4, 15.0, [("ihc_id","PK"),("report_id","FK"),("marker_name",""),("result",""),("intensity","")]),
 "Morphological_Features":(18.4, 9.6, [("feature_id","PK"),("report_id","FK"),("feature_type",""),("feature_value","")]),
 "Report_Addenda":(6.4, 4.6, [("addendum_id","PK"),("report_id","FK"),("author_id","FK"),("old_diagnosis / new_diagnosis",""),("revision_note",""),("created_at","")]),
 "Case_Audit_Logs":(0.3, 4.6, [("log_id","PK"),("case_id","FK"),("action",""),("old_status / new_status",""),("performed_by","FK"),("timestamp","")]),
}
W=4.4; H=0.36
fig,ax=plt.subplots(figsize=(26,17)); ax.set_xlim(0,23.5); ax.set_ylim(0,15.6); ax.axis("off")
pos={}
for n,(x,y,at) in T.items():
    h=H*(len(at)+1.2)
    ax.add_patch(FancyBboxPatch((x,y-h),W,h,boxstyle="round,pad=0.02",fc="white",ec="#0f2d52",lw=1.6))
    ax.add_patch(FancyBboxPatch((x,y-H*1.2),W,H*1.2,boxstyle="round,pad=0.02",fc="#0f2d52",ec="#0f2d52"))
    ax.text(x+W/2,y-H*0.6,n,color="white",ha="center",va="center",fontsize=11,fontweight="bold")
    for i,(a,f) in enumerate(at):
        yy=y-H*1.2-H*(i+0.5)
        tag=(f+"  ") if f else "      "
        col={"PK":"#c62828","FK":"#1565c0"}.get(f,"#222")
        ax.text(x+0.1,yy,tag,fontsize=8.5,color=col,fontweight="bold",va="center",family="monospace")
        ax.text(x+0.62,yy,a,fontsize=9,color="#222",va="center")
    pos[n]=(x,y,h)
def mid(n,side):
    x,y,h=pos[n]
    return {"l":(x,y-h/2),"r":(x+W,y-h/2),"t":(x+W/2,y),"b":(x+W/2,y-h)}[side]

def line(pts,l1=None,p1=None,l2=None,p2=None):
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    ax.plot(xs,ys,color="#455a64",lw=1.6,zorder=0)
    if l1: ax.text(p1[0],p1[1],l1,fontsize=12,fontweight="bold",color="#c62828",ha="center")
    if l2: ax.text(p2[0],p2[1],l2,fontsize=12,fontweight="bold",color="#c62828",ha="center")
def at(n,side,dy=0): 
    x,y=mid(n,side); return (x,y+dy)
# Patients 1 - N Cases
a=at("Patients","b"); b=at("Cases","t"); line([a,b],"1",(a[0]+.25,a[1]-.4),"N",(b[0]+.25,b[1]+.15))
# Cases 1 - N Audit
a=at("Cases","b"); b=at("Case_Audit_Logs","t"); line([a,b],"1",(a[0]+.25,a[1]-.4),"N",(b[0]+.25,b[1]+.15))
# Cases 1 - 1 Specimens
a=at("Cases","r",1.0); b=at("Specimens","l"); line([a,(a[0]+0.9,a[1]),(a[0]+0.9,b[1]),b],"1",(a[0]+.3,a[1]+.1),"1",(b[0]-.3,b[1]+.1))
# Cases 1 - 1 Reports
a=at("Cases","r",-0.3); b=at("Reports","l",0.6); line([a,b],"1",(a[0]+.3,a[1]+.1),"1",(b[0]-.3,b[1]+.1))
# Reports 1 - N IHC
a=at("Reports","r",1.0); b=at("IHC_Results","l"); line([a,(a[0]+1.0,a[1]),(a[0]+1.0,b[1]),b],"1",(a[0]+.3,a[1]+.1),"N",(b[0]-.3,b[1]+.1))
# Reports 1 - N Morph
a=at("Reports","r",-0.2); b=at("Morphological_Features","l"); line([a,(a[0]+1.4,a[1]),(a[0]+1.4,b[1]),b],"1",(a[0]+.3,a[1]+.1),"N",(b[0]-.3,b[1]+.1))
# Reports 1 - N Addenda
a=at("Reports","b"); b=at("Report_Addenda","t"); line([a,b],"1",(a[0]+.25,a[1]-.4),"N",(b[0]+.25,b[1]+.15))
# Users 1 - N Addenda (author_id)
a=at("Users","l"); b=at("Report_Addenda","r"); line([a,b],"1",(a[0]-.3,a[1]+.1),"N",(b[0]+.3,b[1]+.1))
# Users 1 - N Reports (pathologist_id) : up from Users, then left into Reports
x0,y0=pos["Users"][0]+W*0.5,pos["Users"][1]; yr=pos["Reports"][1]-pos["Reports"][2]+0.55
xr=pos["Reports"][0]+W
line([(x0,y0),(x0,yr),(xr,yr)],"1",(x0+.3,y0+.15),"N",(xr+.3,yr+.1))
# Users 1 - N Audit (performed_by): below everything
ub=at("Users","b"); ab=at("Case_Audit_Logs","b"); yb=min(ub[1],ab[1])-1.1
line([ub,(ub[0],yb),(ab[0],yb),ab],"1",(ub[0]+.3,ub[1]-.5),"N",(ab[0]+.3,ab[1]-.5))
ax.text(12.6,yb-0.5,"(Users 1:N Case_Audit_Logs via performed_by)",fontsize=10,color="#455a64")
ax.text(17.3,3.0,"Users.reports_to → Users.user_id\n(self-reference: organisation\nhierarchy, recursive query)",fontsize=10,color="#6a1b9a",style="italic")
ax.set_title("HistoPath CMS - Entity Relationship Diagram   (PK = primary key, FK = foreign key)",fontsize=18,fontweight="bold",color="#0f2d52")
plt.savefig("ER_diagram.png",dpi=110,bbox_inches="tight"); print("saved")
