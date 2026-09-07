-- The pages of a scanned document, fingerprinted. A folder of scans can then
-- be processed one file at a time, in any order, on any day, and a file that
-- was already read is recognised by its bytes rather than by its name — no
-- renaming, no second copy.
alter table hub.child_documents add column if not exists page_hashes text[] not null default '{}';
create index if not exists child_documents_hashes_idx on hub.child_documents using gin (page_hashes);
notify pgrst, 'reload schema';
