import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readInvitation,invitationPath,invitationUrl} from '../lib/invitations.ts';
test('normal visits have no invitation, but legacy shared links are preserved',()=>{
  assert.equal(readInvitation(undefined,''),null);
  assert.deepEqual(readInvitation(undefined,'?room=abcd2345'),{code:'ABCD2345',error:null});
});
test('dedicated routes normalize their code without depending on query parameters',()=>{
  assert.equal(readInvitation('abcd2345','?room=ZXCV2345')?.code,'ABCD2345');
  assert.equal(invitationPath('abcd2345'),'/join/ABCD2345');
  assert.equal(invitationUrl('https://example.test','ABCD2345'),'https://example.test/join/ABCD2345');
});
test('empty, invalid, and truncated codes stay explicit invalid invitations rather than landing on home',()=>{
  for(const code of ['', 'ABCD', 'ABCD2345extra', 'INVALID1', '<script>']) {
    const result=readInvitation(code);assert.ok(result);assert.equal(result.code,null);assert.ok(result.error);
    assert.throws(()=>invitationPath(code));
  }
  assert.ok(readInvitation(undefined,'?room=')?.error);
});
