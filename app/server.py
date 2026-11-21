"""Two dependency-free local services: MarketingOS and a durable headless CMS."""
import hmac
import html
import json
import mimetypes
import os
import re
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from .core import CANON, ROOT, SKILL, CMS, Marketing, Problem, Store, request_json

def page_html(article=None,pages=None):
    e=html.escape
    description=article["description"] if article else "The fictional Northstar resource hub. Local CMS demonstration."
    if article:
        title=article['title']
        structured={'@context':'https://schema.org','@type':'Article','headline':title,'description':article['description'],'datePublished':article['published_at'],'author':{'@type':'Organization','name':'Northstar (fictional demo)'}}
        content=f'<a class="back" href="/">← All resources</a><div class="eyebrow">THE NORTHSTAR JOURNAL · OPERATIONS</div><h1>{e(title)}</h1><p class="lead">{e(article["description"])}</p><div class="byline"><span class="avatar">N</span><span>Northstar editorial team<br><small>Fictional demo · revision {article["revision"]}</small></span><span class="tag">Published locally</span></div>'
        for section in article['sections']:
            source=next((s for s in article.get('sources',[]) if s['id']==section['source_id']),None)
            content+=f'<section><h2>{e(section["heading"])}</h2><p>{e(section["text"])}</p><small class="source">Source: {e(source["title"] if source else section["source_id"])}</small></section>'
        content+='<aside><h2>Good work deserves a clear process.</h2><p>Build shared knowledge, review every revision, and keep an accountable publishing history.</p><a href="/">Explore the resource hub →</a></aside>'
        metadata='<script type="application/ld+json">'+json.dumps(structured).replace('<','\\u003c')+'</script>'
    else:
        title='Ideas for a more connected team'
        metadata=''
        content='<div class="eyebrow">THE NORTHSTAR JOURNAL</div><h1>Clear thinking.<br>Better operations.</h1><p class="lead">Practical ideas for bringing your people, knowledge and workflows together.</p><div class="articles">'
        if not pages:
            content+='<section><h2>Your first story starts in MarketingOS.</h2><p>Approve a draft and publish it to see a real article here.</p></section>'
        for article in pages or []:
            content+=f'<a class="article-card" href="/articles/{e(article["slug"])}"><span class="eyebrow">FIELD NOTES · REVISION {article["revision"]}</span><h2>{e(article["title"])}</h2><p>{e(article["description"])}</p><strong>Read the story ↗</strong></a>'
        content+='</div>'
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="{e(description)}"><title>{e(title)} · Northstar</title>{metadata}<link rel="stylesheet" href="/cms.css"></head><body><header><a class="brand" href="/">✳ northstar<span>WORK, TOGETHER.</span></a><nav><a href="/">Resources</a><span class="tag">LOCAL CMS DEMO</span></nav></header><main>{content}</main><footer><span>Northstar is a fictional business. All content is demonstration material.</span><span>Powered by BuildrLab MarketingOS</span></footer></body></html>'''

LOCAL_HOSTS={'localhost','127.0.0.1','[::1]'}

def allowed_hosts():
    """Hostnames (without port) the services answer to; extend with ALLOWED_HOSTS=a,b."""
    extra={h.strip().lower() for h in os.getenv('ALLOWED_HOSTS','').split(',') if h.strip()}
    return LOCAL_HOSTS|extra

def host_allowed(host):
    name=host.strip().lower()
    if name.startswith('['):
        name=name.split(']')[0]+']'
    else:
        name=name.split(':')[0]
    return name in allowed_hosts()

def make_handler(role,store,marketing=None,cms=None,cms_key=None):
    if role=='cms' and not cms_key:
        raise ValueError('cms_key is required for the cms role; set CMS_KEY.')
    class Handler(BaseHTTPRequestHandler):
        server_version='MarketingOS/1.0'
        timeout=15  # drop idle or trickling clients instead of pinning a thread
        def log_message(self,*args):
            pass

        def respond(self,status,body,ctype='application/json; charset=utf-8'):
            if isinstance(body,(dict,list)):
                body=json.dumps(body).encode()
            elif isinstance(body,str):
                body=body.encode()
            self.send_response(status)
            self.send_header('Content-Type',ctype)
            self.send_header('Content-Length',str(len(body)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.send_header('Referrer-Policy','no-referrer')
            self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError,ConnectionResetError):
                pass

        def error(self,exc):
            if isinstance(exc,Problem):
                self.respond(exc.status,{'error':str(exc)})
            else:
                traceback.print_exc()
                self.respond(500,{'error':'An unexpected local service error occurred. Check the container logs.'})

        def do_GET(self):
            try:
                if not host_allowed(self.headers.get('Host','')):
                    raise Problem('Host not allowed.',403)
                path=unquote(urlsplit(self.path).path)
                if path=='/api/health':
                    return self.respond(200,{'status':'ok','service':role})
                if role=='cms':
                    if path=='/api/pages':
                        return self.respond(200,cms.pages())
                    if path=='/':
                        return self.respond(200,page_html(pages=cms.pages()),'text/html; charset=utf-8')
                    if path.startswith('/articles/'):
                        article=cms.page(path[len('/articles/'):])
                        if not article:
                            raise Problem('Article not found.',404)
                        return self.respond(200,page_html(article=article),'text/html; charset=utf-8')
                    if path=='/cms.css':
                        return self.respond(200,(ROOT/'web/cms.css').read_bytes(),'text/css; charset=utf-8')
                    raise Problem('Not found.',404)
                if path=='/api/state':
                    try:
                        published=request_json(marketing.cms_url+'/api/pages',timeout=2)
                        cms_ok=True
                    except Exception:
                        published=[]
                        cms_ok=False
                    with store.lock:
                        runs=store.all()
                        events=store.history()
                        prompt=store.setting('prompt')
                    return self.respond(200,{'runs':runs,'events':events,'sources':CANON,'skill':SKILL,'prompt_version':prompt,'cms':{'connected':cms_ok,'pages':published,'public_url':os.getenv('CMS_PUBLIC_URL','http://localhost:8031')},'local_model':os.getenv('OLLAMA_MODEL','qwen2.5:1.5b'),'demo_notice':'Local portfolio demo. Reviewer names are labels, not authenticated identities. Sample mode uses deterministic source composition; it makes no LLM calls.'})
                if path=='/api/export':
                    with store.lock:
                        return self.respond(200,{'runs':store.all(),'events':store.history(),'sources':CANON,'skill':SKILL})
                file=(ROOT/'web'/('index.html' if path=='/' else path.lstrip('/'))).resolve()
                if not file.is_relative_to((ROOT/'web').resolve()) or not file.is_file():
                    raise Problem('Not found.',404)
                self.respond(200,file.read_bytes(),mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
            except Exception as exc:
                self.error(exc)

        def do_POST(self):
            try:
                host=self.headers.get('Host','')
                if not host_allowed(host):
                    raise Problem('Host not allowed.',403)
                origin=self.headers.get('Origin')
                if origin and origin!=f'http://{host}':
                    raise Problem('Cross-origin requests are not allowed.',403)
                if 'application/json' not in self.headers.get('Content-Type',''):
                    raise Problem('Use application/json.',415)
                try:
                    length=int(self.headers.get('Content-Length','0'))
                except ValueError:
                    raise Problem('Invalid content length.')
                if not 0<length<=100_000:
                    raise Problem('Request must be smaller than 100 KB.',413)
                try:
                    data=json.loads(self.rfile.read(length))
                except (ValueError,UnicodeDecodeError):
                    raise Problem('Invalid JSON.')
                if not isinstance(data,dict):
                    raise Problem('Request must be a JSON object.')
                path=urlsplit(self.path).path
                if role=='cms':
                    if not hmac.compare_digest(self.headers.get('X-CMS-Key','').encode(),cms_key.encode()):
                        raise Problem('CMS service credential required.',403)
                    if path=='/api/publish':
                        return self.respond(200,cms.publish(data))
                    raise Problem('Not found.',404)
                if path=='/api/runs':
                    return self.respond(201,marketing.create(data))
                if path=='/api/settings/prompt':
                    version=data.get('version')
                    if version not in SKILL['prompt_versions']:
                        raise Problem('Unknown prompt version.')
                    with store.lock:
                        previous=store.setting('prompt')
                        store.set_setting('prompt',version)
                        store.event(None,'prompt_switched',{'from':previous,'to':version,'note':'Existing runs retain their pinned prompt version.'})
                    return self.respond(200,{'version':version})
                match=re.fullmatch(r'/api/runs/([a-f0-9]{12})/(edit|approve|reject|publish)',path)
                if match:
                    return self.respond(200,getattr(marketing,match[2])(match[1],data))
                raise Problem('Not found.',404)
            except Exception as exc:
                self.error(exc)
    return Handler

def main():
    role=sys.argv[1] if len(sys.argv)>1 else 'app'
    if role not in {'app','cms'}:
        raise SystemExit('Choose app or cms')
    port=int(os.getenv('PORT','8030' if role=='app' else '8031'))
    store=Store(os.getenv('DB_PATH',str(ROOT/'runtime'/f'{role}.sqlite')))
    cms_key=os.getenv('CMS_KEY')
    if not cms_key:
        raise SystemExit('CMS_KEY is required. Set it to a long random value (see .env.example).')
    marketing=Marketing(store,os.getenv('CMS_URL','http://127.0.0.1:8031'),cms_key) if role=='app' else None
    server=ThreadingHTTPServer((os.getenv('HOST','127.0.0.1'),port),make_handler(role,store,marketing,CMS(store) if role=='cms' else None,cms_key))
    print(f'{role} ready at http://localhost:{port}',flush=True)
    server.serve_forever()

if __name__=='__main__':
    main()
