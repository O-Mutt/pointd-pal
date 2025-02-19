ALTER TABLE
  configs RENAME COLUMN "notification_room" TO "notification_channel";

ALTER TABLE
  configs RENAME COLUMN "scoreboard_room" TO "scoreboard_channel";

ALTER TABLE
  configs RENAME COLUMN "false_positive_room" TO "false_positive_channel";