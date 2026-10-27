import json,collections,sys
f=open(sys.argv[1] if len(sys.argv)>1 else 'work/data/rivers-full.json');buf='';count=0;cs=collections.Counter();out=open(sys.argv[2] if len(sys.argv)>2 else 'work/data/rivers.ndjson','w');decoder=json.JSONDecoder()
while '"features": [' not in buf:
 s=f.read(65536)
 if not s:raise Exception('no features')
 buf+=s
buf=buf.split('"features": [',1)[1]
while True:
 buf=buf.lstrip(' \n\r\t,')
 if buf.startswith(']'):break
 try:
  obj,end=decoder.raw_decode(buf)
  out.write(json.dumps(obj,separators=(',',':'))+'\n');count+=1;cs[obj['properties']['CdOH'][:2]]+=1;buf=buf[end:]
 except json.JSONDecodeError:
  chunk=f.read(1048576)
  if not chunk:break
  buf+=chunk
out.close();print(count,cs)
