# Make's database

Make runs on the ELUM platform: the same Supabase project as Write, Type and ELUM Account.

## Order

The platform comes first. These come from the Write repository (`supabase/migrations/`) and are copied
in `supabase/platform/` here only so the tests can build a database:

1. `20261017000000_elum_write.sql` to `20261021120000_elum_services_domain.sql`
2. `20261024000000_profile_for_every_account.sql` (every Auth account gets a profile)

Then Make's own:

3. `migrations/20261025000000_make_schema.sql`

It adds the `make` schema (designs and shares), the `make-images` storage bucket with its policies,
the `make.design.shared` notification, and opens Make (beta) in `elum.services`. It is safe to read
before running: it only creates new things, plus that one row in `elum.services`.

## How the app reaches it

The app calls only these functions, which check who may see and change each design:

| Function | Who | What |
| --- | --- | --- |
| `make_list()` | signed in | designs you own or that were shared with you |
| `make_create(title, kind, width, height, content)` | signed in | a new design you own |
| `make_get(id)` | viewers | one design with its content and version |
| `make_save(id, version, content, title)` | editors | saves if nobody saved in between (else PT409) |
| `make_rename`, `make_resize` | editors | name and page size |
| `make_duplicate(id)` | viewers | a copy you own |
| `make_delete(id)` | owner deletes; others leave it | |
| `make_shares`, `make_share`, `make_unshare` | editors share | by ELUM email, to view or edit |
| `make_find_people(query)` | signed in | people to share with |

Pictures live in the private `make-images` bucket at `<design id>/<file>`. People who can view a design
can read its pictures (through signed links); editors can add and remove them.

## Tests

```sh
PGHOST=localhost PGUSER=postgres sh supabase/tests/run.sh
```
