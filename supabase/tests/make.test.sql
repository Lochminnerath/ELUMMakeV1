-- ELUM Make: designs, saving with versions, sharing, notifications and picture storage.
\set ON_ERROR_STOP on
\set QUIET on

\set ada '00000000-0000-0000-0000-0000000000b1'
\set bo  '00000000-0000-0000-0000-0000000000b2'
\set cy  '00000000-0000-0000-0000-0000000000b3'

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (:'ada', 'ada@example.org', now(), '{"name": "Ada Okafor"}'),
  (:'bo', 'bo@example.org', now(), '{"name": "Bo Lin"}'),
  (:'cy', 'cy@example.org', now(), '{"name": "Cy Park"}');

-- ----------------------------------------------------------------- designs
select set_config('request.jwt.claim.sub', :'ada', false);
set role authenticated;
select expect(jsonb_array_length(make_list()) = 0, 'nothing yet');
create temp table ids as select (make_create('Pitch deck', 'presentation', 1920, 1080,
  '{"pages": [{"id": "p1", "background": "#ffffff", "elements": [{"id": "e1", "type": "text", "text": "Hello"}]}]}') ->> 'id')::uuid as deck;
select expect((select make_get(deck) ->> 'role' from ids) = 'owner', 'the owner opens it');
select expect((select (make_get(deck) ->> 'version')::int from ids) = 1, 'version 1');
select expect((select make_get(deck) #>> '{content,pages,0,elements,0,text}' from ids) = 'Hello', 'content comes back');
select expect((select (make_list() -> 0 ->> 'pageCount')::int) = 1, 'the list counts pages');
select expect((select make_list() -> 0 #>> '{cover,id}') = 'p1', 'and carries the cover page for a thumbnail');
select expect((select (make_save(deck, 1, '{"pages": []}', 'Pitch deck v2') ->> 'version')::int from ids) = 2, 'saving bumps the version');
select expect_error(format($$select make_save('%s', 1, '{"pages": []}')$$, (select deck from ids)), 'PT409', 'a stale save is refused');
select expect_error(format($$select make_save('%s', 2, '{"nope": 1}')$$, (select deck from ids)), 'PT400', 'content needs pages');
select expect((select make_get(deck) ->> 'title' from ids) = 'Pitch deck v2', 'title saved with content');
select make_rename(deck, '  Q4 pitch  ') from ids;
select expect((select make_get(deck) ->> 'title' from ids) = 'Q4 pitch', 'renamed, trimmed');
select expect_error(format($$select make_rename('%s', '   ')$$, (select deck from ids)), 'PT400', 'names cannot be empty');
select make_resize(deck, 1080, 1080) from ids;
select expect((select (make_get(deck) ->> 'version')::int from ids) = 2, 'resizing keeps the version, so open editors keep saving');
select expect((select (make_get(deck) ->> 'width')::int from ids) = 1080, 'resized');
select expect_error(format($$select make_resize('%s', 50, 1080)$$, (select deck from ids)), 'PT400', 'sensible sizes only');
select expect_error('select * from make.designs', '42501', 'tables are closed to the app');
reset role;
grant select on ids to authenticated;

-- ----------------------------------------------------------------- sharing
select set_config('request.jwt.claim.sub', :'bo', false);
set role authenticated;
select expect_error(format($$select make_get('%s')$$, (select deck from ids)), 'PT404', 'strangers cannot open it');
select expect(jsonb_array_length(make_list()) = 0, 'nor see it listed');
reset role;

select set_config('request.jwt.claim.sub', :'ada', false);
set role authenticated;
select expect((select make_share(deck, 'BO@example.org', 'viewer') ->> 'name' from ids) = 'Bo Lin', 'share by email, any case');
select expect_error(format($$select make_share('%s', 'nobody@example.org')$$, (select deck from ids)), 'PT404', 'only ELUM accounts');
select expect_error(format($$select make_share('%s', 'ada@example.org')$$, (select deck from ids)), 'PT400', 'not with the owner');
select expect_error(format($$select make_share('%s', 'cy@example.org', 'owner')$$, (select deck from ids)), 'PT400', 'view or edit only');
select expect(jsonb_array_length((select make_shares(deck) from ids)) = 1, 'who it is shared with');
select expect((select make_find_people('bo') -> 0 ->> 'email') = 'bo@example.org', 'find people to share with');
select expect(jsonb_array_length(make_find_people('a')) = 0, 'searches need two letters');
reset role;

select expect((select count(*) from elum.notifications where account_id = :'bo' and type = 'make.design.shared'
               and link = '/m/' || (select deck from ids)) = 1, 'Bo is notified, with a link to the design');

select set_config('request.jwt.claim.sub', :'bo', false);
set role authenticated;
select expect((select make_get(deck) ->> 'role' from ids) = 'viewer', 'Bo views it');
select expect((make_list() -> 0 ->> 'role') = 'viewer', 'and sees it listed as shared');
select expect_error(format($$select make_save('%s', 3, '{"pages": []}')$$, (select deck from ids)), 'PT403', 'viewers cannot save');
select expect_error(format($$select make_share('%s', 'cy@example.org')$$, (select deck from ids)), 'PT403', 'viewers cannot share');
select expect((select make_duplicate(deck) ->> 'role' from ids) = 'owner', 'but can make their own copy');
reset role;

select set_config('request.jwt.claim.sub', :'ada', false);
set role authenticated;
select make_share(deck, 'bo@example.org', 'editor') from ids;
reset role;
select set_config('request.jwt.claim.sub', :'bo', false);
set role authenticated;
select expect((select (make_save(deck, (make_get(deck) ->> 'version')::int, '{"pages": [{"id": "p2", "elements": []}]}') ->> 'version')::int from ids) = 3,
              'editors save');
select expect((select make_get(deck) #>> '{updatedBy,name}' from ids) = 'Bo Lin', 'and it shows who saved last');
select expect_error(format($$select make_unshare('%s', '00000000-0000-0000-0000-0000000000b1')$$, (select deck from ids)), 'PT400', 'nobody removes the owner');

-- --------------------------------------------------------------- pictures
select expect_error(format($$insert into storage.objects (bucket_id, name) values ('make-images', '%s/face.png')$$, gen_random_uuid()),
                    '42501', 'no uploads into designs you cannot edit');
insert into storage.objects (bucket_id, name) select 'make-images', deck || '/photo.png' from ids;
select expect((select count(*) from storage.objects where bucket_id = 'make-images') = 1, 'editors upload and read pictures');
select make_delete(deck) from ids;
select expect((select count(*) from make_list() x(v), jsonb_array_elements(v) e where e ->> 'title' = 'Q4 pitch') = 0, 'leaving takes it off your list');
reset role;
select expect((select count(*) from make.designs where id = (select deck from ids)) = 1, 'but the design stays for its owner');

select set_config('request.jwt.claim.sub', :'ada', false);
set role authenticated;
select make_delete(deck) from ids;
reset role;
select expect((select count(*) from make.designs where id = (select deck from ids)) = 0, 'the owner deletes it');
select expect((select count(*) from storage.objects where bucket_id = 'make-images') = 0, 'with its pictures');

\echo 'Make checks passed.'
