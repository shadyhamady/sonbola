-- How a production was entered: pieces (NULL), batches or kg. `units` always holds the resulting pieces.
ALTER TABLE productions ADD COLUMN input_unit TEXT CHECK(input_unit IN ('batches','kg'));
ALTER TABLE productions ADD COLUMN input_qty REAL;
