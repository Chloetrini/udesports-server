/*
  One-time data fix following the previousClubName/currentClubName rename
  (see 20260915120000_rename_club_fields_to_previous_current).

  Before that rename, every existing player's one-and-only club was stored
  in what was then called "currentClubName"/"currentClubLogo" — the old
  "newClubName"/"newClubLogo" fields were basically never populated, since
  nothing displayed them yet. The rename moved that real, displayed club
  data into "previousClubName"/"previousClubLogo" and left the new
  "currentClubName"/"currentClubLogo" empty for those players, which made
  it look like every pre-existing player had been "transferred" (arrow +
  previous club showing) when in fact they never had a transfer at all.

  This fixes it: for any player whose "currentClubName" is empty but who
  has something in "previousClubName", that's not a real transfer — it's
  just their one club sitting in the wrong column after the rename. Move
  it back into the current-club fields and clear the previous-club fields,
  so they read as "current club only, no transfer" again.

  Players who already have a real currentClubName (i.e. an actual transfer
  recorded through the admin form since this feature shipped) are left
  untouched — the WHERE clause only matches rows with no current club set.
*/

UPDATE "Player"
SET "currentClubName" = "previousClubName",
    "currentClubLogo" = "previousClubLogo",
    "previousClubName" = NULL,
    "previousClubLogo" = NULL
WHERE ("currentClubName" IS NULL OR "currentClubName" = '')
  AND "previousClubName" IS NOT NULL
  AND "previousClubName" != '';
