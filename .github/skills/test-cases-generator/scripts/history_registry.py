#!/usr/bin/env python3
"""Story history registry helper for QA Test Design Validator.

Commands:
  lookup   --registry assets/story_history_registry.json --story-id US-101
  compare  --registry ... --story-id US-101 --story current_story.txt
  baseline --registry ... --story-id US-101 --story current_story.txt --version 1.0 --tests tests.csv --approved

The script deliberately does not decide semantic business impact. It provides
stable hashing, lookup, test-count capture and append-only baseline history.
Semantic delta/impact classification remains source-aware QA work.
"""
import argparse, csv, hashlib, json
from datetime import datetime, timezone
from pathlib import Path

def now(): return datetime.now(timezone.utc).isoformat()
def norm(text): return " ".join(text.split())
def digest(text): return hashlib.sha256(norm(text).encode('utf-8')).hexdigest()
def load(path):
    p=Path(path)
    if not p.exists(): return {"schema_version":"1.0","updated_at":None,"stories":{}}
    return json.loads(p.read_text(encoding='utf-8'))
def save(path,data):
    data['updated_at']=now(); Path(path).write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
def count_tests(path, story_id):
    if not path: return (0,[])
    with open(path,encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
    ids=[]
    for r in rows:
        sid=(r.get('Story ID') or r.get('StoryID') or '').strip()
        if not sid or sid==story_id:
            tc=(r.get('Test Case ID') or r.get('TC ID') or '').strip()
            if tc: ids.append(tc)
    return len(ids),ids

def main():
    ap=argparse.ArgumentParser()
    sub=ap.add_subparsers(dest='cmd',required=True)
    for name in ['lookup','compare','baseline']:
        p=sub.add_parser(name); p.add_argument('--registry',required=True); p.add_argument('--story-id',required=True)
        if name in ['compare','baseline']: p.add_argument('--story',required=True)
        if name=='baseline':
            p.add_argument('--version',default='1.0'); p.add_argument('--tests'); p.add_argument('--approved',action='store_true')
    a=ap.parse_args(); data=load(a.registry); rec=data.get('stories',{}).get(a.story_id)
    if a.cmd=='lookup':
        print(json.dumps({"found":bool(rec),"story":rec},indent=2)); return
    text=Path(a.story).read_text(encoding='utf-8'); h=digest(text)
    if a.cmd=='compare':
        print(json.dumps({"found":bool(rec),"story_id":a.story_id,"previous_hash":rec.get('requirement_hash') if rec else None,"current_hash":h,"changed":(not rec) or rec.get('requirement_hash')!=h,"semantic_impact":"REQUIRES_QA_CLASSIFICATION"},indent=2)); return
    if not a.approved:
        raise SystemExit('Refusing to baseline an unapproved draft. Re-run with --approved after Human QA approval.')
    count,ids=count_tests(a.tests,a.story_id)
    old=rec or {}
    history=list(old.get('change_history',[]))
    if old:
        history.append({"version":old.get('current_version'),"requirement_hash":old.get('requirement_hash'),"test_case_count":old.get('test_case_count'),"superseded_at":now()})
    data.setdefault('stories',{})[a.story_id]={
        **{k:v for k,v in old.items() if k not in ['change_history']},
        "story_id":a.story_id,"current_version":a.version,"requirement_hash":h,
        "approved_requirement_snapshot":text,"test_case_ids":ids,"test_case_count":count,
        "approved_test_case_count":count,"last_approved_at":now(),"change_history":history
    }
    save(a.registry,data)
    print(json.dumps({"status":"BASELINE_UPDATED","story_id":a.story_id,"version":a.version,"requirement_hash":h,"test_case_count":count},indent=2))
if __name__=='__main__': main()
