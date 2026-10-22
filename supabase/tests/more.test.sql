-- ELUM Make: version history, comments, brand kits, your templates, tags, views and favourites.
\set ON_ERROR_STOP on
\set QUIET on

\set ada '00000000-0000-0000-0000-0000000000c1'
\set bo  '00000000-0000-0000-0000-0000000000c2'
\set cy  '00000000-0000-0000-0000-0000000000c3'

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (:'ada', 'ada@example.org', now(), '{"name": "Ada Okafor"}'),
  (:'bo', 'bo@example.org', now(), '{"name": "Bo Lin"}'),
  (:'cy', 'cy@example.org', now(), '{"name": "Cy Park"}');

select set_config('request.jwt.claim.sub', :'ada', false);
set role authenticated;
create temp table ids as select (make_create('Deck', 'presentation', 1920, 1080, '{"pages": [{"id": "p1"}]}') ->> 'id')::uuid as deck;
select make_share(deck, 'bo@example.org', 'viewer') from ids;

-- ---------------------------------------------------------------- history
select make_save(deck, 1, '{"pages": [{"id": "p2"}]}') from ids;
select expect((select jsonb_array_length(make_versions(deck)) from ids) = 1, 'a save keeps the version before it');
select expect((select make_versions(deck) -> 0 #>> '{preview,id}' from ids) = 'p1', 'with its first page as a preview');
select make_save(deck, 2, '{"pages": [{"id": "p3"}]}') from ids;
select expect((select jsonb_array_length(make_versions(deck)) from ids) = 1, 'quick saves do not flood the history');
select expect((select (make_restore_version(deck, 1) ->> 'version')::int from ids) = 4, 'restoring is a new version');
select expect((select make_get(deck) #>> '{content,pages,0,id}' from ids) = 'p1', 'with the old content back');
select expect((select jsonb_array_length(make_versions(deck)) from ids) = 2, 'and what it replaced is kept, so it can be undone');
select expect_error(format($$select make_restore_version('%s', 99)$$, (select deck from ids)), 'PT404', 'unknown versions');

-- --------------------------------------------------------------- comments
create temp table c as select (make_add_comment(deck, '  Nice title  ', null, 0, 10, 20) ->> 'id')::uuid as id from ids;
select expect((select make_comments(deck) -> 0 ->> 'body' from ids) = 'Nice title', 'comment added, trimmed');
select expect((select make_comments(deck) -> 0 #>> '{position,page}' from ids) = '0', 'pinned to a page');
select expect_error(format($$select make_add_comment('%s', '   ')$$, (select deck from ids)), 'PT400', 'comments need words');
reset role;
grant select on ids, c to authenticated;

select set_config('request.jwt.claim.sub', :'bo', false);
set role authenticated;
select make_add_comment(deck, 'Agreed', (select id from c)) from ids;
select expect((select make_comments(deck) -> 0 -> 'replies' -> 0 ->> 'body' from ids) = 'Agreed', 'viewers can reply');
select expect_error(format($$select make_resolve_comment('%s', true)$$, (select id from c)), 'PT403', 'viewers cannot resolve other people''s comments');
select expect_error(format($$select make_restore_version('%s', 1)$$, (select deck from ids)), 'PT403', 'viewers cannot restore');
reset role;

select set_config('request.jwt.claim.sub', :'cy', false);
set role authenticated;
select expect_error(format($$select make_comments('%s')$$, (select deck from ids)), 'PT404', 'strangers cannot read comments');
select expect_error(format($$select make_versions('%s')$$, (select deck from ids)), 'PT404', 'or history');
select expect_error(format($$select make_favorite('%s', true)$$, (select deck from ids)), 'PT404', 'or favourite it');
reset role;

select set_config('request.jwt.claim.sub', :'ada', false);
set role authenticated;
select make_resolve_comment(id, true) from c;
select expect((select (make_comments(deck) -> 0 ->> 'resolved')::boolean from ids), 'the owner resolves it');

-- ------------------------------------------------------------- brand kits
create temp table k as select (make_save_brand_kit(null, 'ELUM', 'Our colours', '[{"value": "#ec7fa9"}]', '[{"value": "Sora"}]') ->> 'id')::uuid as id;
select expect((select make_brand_kit(id) #>> '{assets,colors,0,value}' from k) = '#ec7fa9', 'a kit keeps its colours');
select make_save_brand_kit(id, 'ELUM 2') from k;
select expect((select make_brand_kits() -> 0 ->> 'name') = 'ELUM 2', 'and can be renamed');
select expect_error($$select make_save_brand_kit(null, '  ')$$, 'PT400', 'kits need a name');
reset role;
grant select on k to authenticated;
select set_config('request.jwt.claim.sub', :'bo', false);
set role authenticated;
select expect(jsonb_array_length(make_brand_kits()) = 0, 'kits are private');
select expect_error(format($$select make_brand_kit('%s')$$, (select id from k)), 'PT404', 'even by id');
select expect_error(format($$select make_save_brand_kit('%s', 'Mine now')$$, (select id from k)), 'PT404', 'and cannot be changed by others');
reset role;

-- -------------------------------------------------------------- templates
select set_config('request.jwt.claim.sub', :'ada', false);
set role authenticated;
create temp table t as select (make_save_as_template(deck, 'My deck', null, 'work') ->> 'id')::uuid as id from ids;
select expect(jsonb_array_length(make_templates('work')) = 1, 'saved as a template');
select expect(jsonb_array_length(make_templates('other')) = 0, 'filtered by category');
create temp table fromt as select (make_create_from_template(id) ->> 'id')::uuid as id from t;
select expect((select make_get(id) #>> '{content,pages,0,id}' from fromt) = 'p1', 'a new design from it has its pages');

-- ---------------------------------------------- tags, views and favourites
select make_set_tags(deck, array['Launch', ' launch ', 'Q4']) from ids;
select expect(jsonb_array_length(make_tag_search(array['q4'])) = 1, 'tags are found, any case');
select expect((select make_tag_search(array['launch']) -> 0 -> 'tags') = '["launch", "q4"]', 'and kept tidy');
select make_view(deck) from ids;
select make_favorite(deck, true) from ids;
select make_favorite(deck, true) from ids;
select expect(jsonb_array_length(make_favorites()) = 1, 'favourited once');
select make_favorite(deck, false) from ids;
select expect(jsonb_array_length(make_favorites()) = 0, 'and unfavourited');
reset role;
select expect((select views from make.designs where id = (select deck from ids)) = 1, 'views counted');

select set_config('request.jwt.claim.sub', :'bo', false);
set role authenticated;
select expect(jsonb_array_length(make_tag_search(array['q4'])) = 1, 'shared designs show up in tag search');
select expect_error(format($$select make_set_tags('%s', array['x'])$$, (select deck from ids)), 'PT403', 'viewers cannot tag');
reset role;
select set_config('request.jwt.claim.sub', :'cy', false);
set role authenticated;
select expect(jsonb_array_length(make_tag_search(array['q4'])) = 0, 'other people''s designs do not');
reset role;

\echo 'History, comments, kits and favourites checks passed.'
