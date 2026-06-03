-- ============================================================================
--  TBLTRIGGER_tblSecrateryRole  (TIS.NET10)
--  Audit trigger for tblSecrateryRole (bill delegation records).
--
--  Fixes vs. the legacy trigger:
--   • Root cause of "converting varchar to bigint": the old trigger did
--       '(Abc)' + (select SecrateryID ...)
--     which adds a string to a bigint and forces a numeric conversion of
--     '(Abc)'. All audit values are now CAST to varchar before being written
--     to the (varchar) NEW_VALUE / OLD_VALUE columns.
--   • Set-based (joins inserted↔deleted on ID) so multi-row updates work.
--   • Logs CanIdentify (the legacy trigger logged CanApprove twice).
--   • Dropped the stray '(Abc)' debug prefix.
-- ============================================================================
ALTER TRIGGER [dbo].[TBLTRIGGER_tblSecrateryRole]
    ON [dbo].[tblSecrateryRole]
    AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only log field-level changes for UPDATEs (rows in both inserted & deleted).
    IF EXISTS (SELECT 1 FROM deleted)
    BEGIN
        -- SecrateryID
        INSERT INTO TBL_AT_DETAILS (NEW_VALUE, OLD_VALUE)
        SELECT CAST(i.SecrateryID AS varchar(50)), CAST(d.SecrateryID AS varchar(50))
        FROM inserted i INNER JOIN deleted d ON i.ID = d.ID;

        -- ManagerID
        INSERT INTO TBL_AT_DETAILS (NEW_VALUE, OLD_VALUE)
        SELECT CAST(i.ManagerID AS varchar(50)), CAST(d.ManagerID AS varchar(50))
        FROM inserted i INNER JOIN deleted d ON i.ID = d.ID;

        -- CanApprove
        INSERT INTO TBL_AT_DETAILS (NEW_VALUE, OLD_VALUE)
        SELECT CAST(i.CanApprove AS varchar(50)), CAST(d.CanApprove AS varchar(50))
        FROM inserted i INNER JOIN deleted d ON i.ID = d.ID;

        -- CanIdentify
        INSERT INTO TBL_AT_DETAILS (NEW_VALUE, OLD_VALUE)
        SELECT CAST(i.CanIdentify AS varchar(50)), CAST(d.CanIdentify AS varchar(50))
        FROM inserted i INNER JOIN deleted d ON i.ID = d.ID;

        -- Drop entries where nothing changed (same semantics as legacy trigger).
        DELETE FROM TBL_AT_DETAILS WHERE NEW_VALUE = OLD_VALUE;
        DELETE FROM TBL_AT_DETAILS WHERE NEW_VALUE IS NULL AND OLD_VALUE IS NULL;
    END
END
