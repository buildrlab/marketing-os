import copy
import io
import json
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app.core import CANON, CMS, Marketing, Problem, Store, checks, cms_error_message, request_json, screen_sources
from app.server import make_handler, page_html

KEY='test-only-key-not-a-secret'

class WorkflowTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.cms_store=Store(Path(self.tmp.name)/'cms.sqlite')
        self.cms=CMS(self.cms_store)
        self.server=ThreadingHTTPServer(('127.0.0.1',0),make_handler('cms',self.cms_store,cms=self.cms,cms_key=KEY))
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.url=f'http://127.0.0.1:{self.server.server_port}'
        self.store=Store(Path(self.tmp.name)/'app.sqlite')
        self.app=Marketing(self.store,self.url,KEY,seed=False)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.store.db.close()
        self.cms_store.db.close()
        self.tmp.cleanup()

    def draft(self,scenario='standard'):
        return self.app.create({'topic':'A useful guide to content operations','audience':'Customer operations leaders','scenario':scenario})

    def approve(self,r):
        return self.app.approve(r['id'],{'revision':r['revision'],'reviewer':'Demo reviewer','attested':True})

    def test_publish_without_approval_is_rejected(self):
        r=self.draft()
        with self.assertRaisesRegex(Problem,'requires approval'):
            self.app.publish(r['id'],{'revision':1})
        self.assertEqual(self.cms.pages(),[])

    def test_happy_path_publishes_real_page_and_is_idempotent(self):
        r=self.approve(self.draft())
        result=self.app.publish(r['id'],{'revision':1})
        self.assertEqual(result['status'],'published')
        page=urlopen(self.url+'/articles/'+result['content']['slug']).read().decode()
        self.assertIn(result['content']['title'],page)
        self.assertIn('application/ld+json',page)
        self.app.publish(r['id'],{'revision':1})
        self.assertEqual(len(self.cms.pages()),1)
        self.assertEqual(self.cms_store.db.execute('SELECT count(*) FROM publications').fetchone()[0],1)

    def test_edit_invalidates_approval_and_preserves_live_page(self):
        r=self.approve(self.draft())
        self.app.publish(r['id'],{'revision':1})
        content=copy.deepcopy(r['content']);content['title']='An updated guide to content operations'
        edited=self.app.edit(r['id'],{'revision':1,'content':content})
        self.assertEqual(edited['revision'],2)
        self.assertIsNone(edited['approval'])
        self.assertEqual(self.cms.pages()[0]['revision'],1)
        with self.assertRaises(Problem):
            self.app.publish(r['id'],{'revision':2})
        self.approve(edited)
        self.app.publish(r['id'],{'revision':2})
        self.assertEqual(len(self.cms.pages()),1)
        self.assertEqual(self.cms.pages()[0]['revision'],2)

    def test_content_tampering_invalidates_hash(self):
        r=self.approve(self.draft())
        r['content']['description']='Changed behind the approval fingerprint.'
        self.store.put(r)
        with self.assertRaisesRegex(Problem,'exact revision'):
            self.app.publish(r['id'],{'revision':1})

    def test_stale_editor_and_reviewer_cannot_overwrite(self):
        r=self.draft()
        self.app.edit(r['id'],{'revision':1,'content':r['content']})
        with self.assertRaisesRegex(Problem,'changed'):
            self.approve(r)
        with self.assertRaisesRegex(Problem,'changed'):
            self.app.edit(r['id'],{'revision':1,'content':r['content']})

    def test_unsupported_claim_blocks_approval_until_corrected(self):
        r=self.draft('unsupported')
        self.assertEqual(r['status'],'blocked')
        self.assertEqual(next(c for c in r['checks'] if c['id']=='claims')['status'],'fail')
        with self.assertRaises(Problem):
            self.approve(r)
        content=r['content'];content['sections'][0]['text']=CANON[0]['content']
        updated=self.app.edit(r['id'],{'revision':1,'content':content})
        self.assertEqual(self.approve(updated)['status'],'approved')

    def test_lost_cms_ack_retry_does_not_duplicate(self):
        r=self.approve(self.draft('cms_timeout'))
        failed=self.app.publish(r['id'],{'revision':1})
        self.assertEqual(failed['status'],'publish_failed')
        self.assertEqual(len(self.cms.pages()),1)
        replay=self.app.publish(r['id'],{'revision':1})
        self.assertEqual(replay['status'],'published')
        self.assertTrue(replay['publication']['replayed'])
        self.assertEqual(self.cms_store.db.execute('SELECT count(*) FROM publications').fetchone()[0],1)

    def test_parallel_publish_is_one_cms_write(self):
        r=self.approve(self.draft())
        with ThreadPoolExecutor(max_workers=4) as pool:
            outcomes=list(pool.map(lambda _:self.app.publish(r['id'],{'revision':1}),range(4)))
        self.assertTrue(all(r['status']=='published' for r in outcomes))
        self.assertEqual(self.cms_store.db.execute('SELECT count(*) FROM publications').fetchone()[0],1)

    def test_cms_rejects_same_key_with_changed_content(self):
        r=self.approve(self.draft())
        payload={'key':r['id']+':r1','content_id':r['id'],'revision':1,'content':r['content'],'approval':r['approval'],'sources':r['sources']}
        self.cms.publish(payload)
        payload['content']['title']='A different article with the same key'
        with self.assertRaisesRegex(Problem,'different content'):
            self.cms.publish(payload)

    def test_cms_refuses_older_revision_and_slug_collision(self):
        r=self.approve(self.draft())
        self.app.publish(r['id'],{'revision':1})
        newer=self.app.edit(r['id'],{'revision':1,'content':r['content']})
        self.approve(newer);self.app.publish(r['id'],{'revision':2})
        other=self.approve(self.draft())
        payload={'key':other['id']+':r1','content_id':other['id'],'revision':1,'content':other['content'],'approval':other['approval'],'sources':other['sources']}
        with self.assertRaisesRegex(Problem,'URL is already'):
            self.cms.publish(payload)

    def test_cms_rejects_unseen_old_revision(self):
        r=self.approve(self.draft())
        def payload(revision):
            return {'key':r['id']+':r'+str(revision),'content_id':r['id'],'revision':revision,'content':r['content'],'approval':{**r['approval'],'revision':revision},'sources':r['sources']}
        self.cms.publish(payload(3))
        with self.assertRaisesRegex(Problem,'newer revision'):
            self.cms.publish(payload(2))
        self.assertEqual(self.cms.pages()[0]['revision'],3)

    def test_local_model_uses_schema_and_reports_actual_usage(self):
        content=self.draft()['content']
        generated={'response':json.dumps(content),'prompt_eval_count':42,'eval_count':51}
        with patch('app.core.request_json',return_value=generated) as request:
            r=self.app.create({'topic':'A guide for accountable content teams','audience':'Marketing teams','mode':'ollama'})
        self.assertEqual(r['mode'],'ollama')
        self.assertEqual(r['usage']['input_tokens'],42)
        self.assertIsNone(r['usage']['api_cost_usd'])
        self.assertEqual(request.call_args.args[1]['format']['type'],'object')
        self.assertIsNone(r['approval'])

    def test_invalid_model_output_does_not_fall_back_to_sample(self):
        before=len(self.store.all())
        with patch('app.core.request_json',return_value={'response':'{"title":"Incomplete"}'}):
            with self.assertRaisesRegex(Problem,'no sample output was substituted'):
                self.app.create({'topic':'A guide for accountable content teams','audience':'Marketing teams','mode':'ollama'})
        self.assertEqual(len(self.store.all()),before)

    def test_sources_are_quarantined_before_generation(self):
        r=self.draft('injection')
        self.assertNotIn('injected-fixture',[s['id'] for s in r['sources']])
        self.assertTrue(any(t['step']=='Quarantine source' for t in r['trace']))
        self.assertIsNone(r['approval'])
        self.assertEqual(self.cms.pages(),[])

    def test_basic_pii_and_invalid_citations_block(self):
        r=self.draft();r['content']['sections'][0]['text']+=' Email customer@example.test.'
        r['content']['sections'][1]['source_id']='nonexistent'
        report=checks(r['content'],r['sources'])
        self.assertEqual(next(c for c in report if c['id']=='privacy')['status'],'fail')
        self.assertEqual(next(c for c in report if c['id']=='sources')['status'],'fail')

    def test_approval_requires_attestation_and_review_note_invalidates(self):
        r=self.draft()
        with self.assertRaisesRegex(Problem,'confirm'):
            self.app.approve(r['id'],{'revision':1,'reviewer':'Name','attested':False})
        self.approve(r)
        rejected=self.app.reject(r['id'],{'revision':1,'comment':'Please clarify the introduction.'})
        self.assertIsNone(rejected['approval'])
        self.assertEqual(rejected['status'],'changes_requested')

    def test_prompt_version_is_pinned_and_rollback_supported(self):
        first=self.draft()
        self.store.set_setting('prompt','v2');second=self.draft()
        self.store.set_setting('prompt','v1');third=self.draft()
        self.assertEqual([first['prompt_version'],second['prompt_version'],third['prompt_version']],['v1','v2','v1'])
        self.assertNotEqual(first['content']['sections'][0]['heading'],second['content']['sections'][0]['heading'])

    def test_durable_state_survives_reopening(self):
        r=self.approve(self.draft())
        reopened=Store(Path(self.tmp.name)/'app.sqlite')
        try:
            self.assertEqual(reopened.get(r['id'])['approval'],r['approval'])
        finally:
            reopened.db.close()

    def test_unauthorized_and_cross_origin_writes_rejected(self):
        with self.assertRaises(HTTPError) as caught:
            request_json(self.url+'/api/publish',{'bad':'request'})
        self.assertEqual(caught.exception.code,403)
        req=Request(self.url+'/api/publish',data=b'{}',headers={'Content-Type':'application/json','X-CMS-Key':KEY,'Origin':'https://example.com'})
        with self.assertRaises(HTTPError) as caught:
            urlopen(req)
        self.assertEqual(caught.exception.code,403)

    def test_cms_rejection_is_not_reported_as_lost_acknowledgement(self):
        first=self.approve(self.draft())
        self.assertEqual(self.app.publish(first['id'],{'revision':first['revision']})['status'],'published')
        second=self.approve(self.draft())  # same topic, therefore the same slug
        result=self.app.publish(second['id'],{'revision':second['revision']})
        self.assertEqual(result['status'],'publish_rejected')
        self.assertIn('already used by another article',result['last_error'])
        self.assertNotIn('Retry safely',result['last_error'])
        self.assertEqual(len(self.cms.pages()),1)

    def test_cms_server_error_remains_retryable(self):
        r=self.approve(self.draft())
        err=HTTPError(self.url,503,'unavailable',{},None)
        with patch('app.core.request_json',side_effect=err):
            result=self.app.publish(r['id'],{'revision':r['revision']})
        self.assertEqual(result['status'],'publish_failed')
        self.assertIn('Retry safely',result['last_error'])

    def test_cms_error_message_classification(self):
        def err(code,body):
            return HTTPError('http://cms',code,'x',{},io.BytesIO(body))
        self.assertEqual(cms_error_message(err(409,b'{"error":"Slug taken."}')),'Slug taken.')
        self.assertEqual(cms_error_message(err(400,b'not json')),'HTTP 400.')
        self.assertEqual(cms_error_message(err(400,b'{"error":""}')),'HTTP 400.')
        self.assertEqual(cms_error_message(err(422,b'{"error":42}')),'HTTP 422.')
        self.assertEqual(cms_error_message(err(404,b'[]')),'HTTP 404.')

    def test_retryable_4xx_statuses_stay_retryable_and_others_are_rejected(self):
        for code,expected in ((408,'publish_failed'),(429,'publish_failed'),(404,'publish_rejected'),(422,'publish_rejected')):
            with self.subTest(code=code):
                r=self.approve(self.draft())
                err=HTTPError(self.url,code,'x',{},io.BytesIO(b'{}'))
                with patch('app.core.request_json',side_effect=err):
                    result=self.app.publish(r['id'],{'revision':r['revision']})
                self.assertEqual(result['status'],expected)

    def test_rejected_revision_can_be_edited_reapproved_and_published(self):
        first=self.approve(self.draft())
        self.app.publish(first['id'],{'revision':first['revision']})
        second=self.approve(self.draft())
        rejected=self.app.publish(second['id'],{'revision':second['revision']})
        self.assertEqual(rejected['status'],'publish_rejected')
        content=copy.deepcopy(rejected['content']);content['slug']='a-distinct-guide-slug'
        edited=self.app.edit(second['id'],{'revision':rejected['revision'],'content':content})
        self.assertIsNone(edited['approval'])
        again=self.approve(edited)
        self.assertEqual(self.app.publish(again['id'],{'revision':again['revision']})['status'],'published')
        self.assertEqual(len(self.cms.pages()),2)

    def test_approval_rejects_stale_revision_and_short_reviewer(self):
        r=self.draft()
        with self.assertRaises(Problem) as caught:
            self.app.approve(r['id'],{'revision':r['revision']+1,'reviewer':'Demo reviewer','attested':True})
        self.assertEqual(caught.exception.status,409)
        for reviewer in ('','x','y'*81):
            with self.subTest(reviewer=reviewer),self.assertRaisesRegex(Problem,'reviewer'):
                self.app.approve(r['id'],{'revision':r['revision'],'reviewer':reviewer,'attested':True})
        with self.assertRaisesRegex(Problem,'confirm'):
            self.app.approve(r['id'],{'revision':r['revision'],'reviewer':'Demo reviewer','attested':'yes'})

    def test_reject_requires_note_of_valid_length(self):
        r=self.draft()
        for comment in ('','ab','c'*1001):
            with self.subTest(length=len(comment)),self.assertRaisesRegex(Problem,'review note'):
                self.app.reject(r['id'],{'revision':r['revision'],'comment':comment})

    def test_explicit_cms_key_is_required(self):
        with self.assertRaises(ValueError):
            Marketing(self.store,self.url,seed=False)
        with self.assertRaises(ValueError):
            make_handler('cms',self.cms_store,cms=self.cms)

    def test_render_escapes_html_and_json_script_breakout(self):
        r=self.draft();p=r['content'];p.update(revision=1,published_at='2026-10-29',sources=r['sources'])
        p['title']='</script><img src=x onerror=alert(1)>'
        rendered=page_html(article=p)
        self.assertNotIn('<img src=x',rendered)
        self.assertIn('\\u003c/script>',rendered)

    def test_pages_reader_does_not_see_uncommitted_transaction(self):
        inside=threading.Event()
        def writer():
            with self.cms_store.lock:
                db=self.cms_store.db
                db.execute('BEGIN IMMEDIATE')
                db.execute("INSERT INTO pages VALUES('aaaaaaaaaaaa','ghost','{\"slug\":\"ghost\"}',1,'now')")
                inside.set()
                time.sleep(0.3)
                db.execute('ROLLBACK')
        thread=threading.Thread(target=writer)
        thread.start()
        inside.wait(5)
        self.assertEqual(self.cms.pages(),[])  # blocks until the rollback
        self.assertIsNone(self.cms.page('ghost'))
        thread.join()

    def test_article_lookup_by_slug(self):
        r=self.approve(self.draft())
        self.app.publish(r['id'],{'revision':r['revision']})
        slug=r['content']['slug']
        self.assertEqual(self.cms.page(slug)['slug'],slug)
        self.assertIsNone(self.cms.page('missing'))
        with self.assertRaises(HTTPError) as caught:
            urlopen(self.url+'/articles/missing')
        self.assertEqual(caught.exception.code,404)

if __name__=='__main__':
    unittest.main(verbosity=2)
