-- ============================================================================
--  Active Directory "Active Status" Sync  (TIS.NET10)
--
--  Purpose: keep tbluser.IsActive in step with Active Directory. When an AD
--  account is Disabled, the application sets tbluser.IsActive = 0 and records
--  the change in tbl_Active_Sync_AD_Log.
--
--  Objects:
--    • tbl_Active_Sync_AD_Log      audit log of every IsActive change made by the sync
--    • sp_GetUsersForActiveSync    returns the users the sync needs to check
--    • sp_Active_Sync_AD_Log_Add   updates tbluser.IsActive AND writes a log row (1 txn)
--
--  NOTE: this assumes tbluser has an [IsActive] BIT column and an [UID] key.
--        If your active flag column is named differently (e.g. [Status]),
--        change it in sp_GetUsersForActiveSync and sp_Active_Sync_AD_Log_Add.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table: tbl_Active_Sync_AD_Log
-- ---------------------------------------------------------------------------
IF OBJECT_ID('dbo.tbl_Active_Sync_AD_Log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_Active_Sync_AD_Log
    (
        ID             INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_tbl_Active_Sync_AD_Log PRIMARY KEY,
        UID            INT          NOT NULL,
        [Datetime]     DATETIME     NOT NULL
            CONSTRAINT DF_tbl_Active_Sync_AD_Log_Datetime DEFAULT (GETDATE()),
        IsActive_Value BIT          NOT NULL
    );
END
GO

-- ---------------------------------------------------------------------------
-- sp_GetUsersForActiveSync
-- Returns the candidate users the AD sync should evaluate. Only currently
-- active users are returned, so already-disabled accounts aren't re-processed
-- (and re-logged) on every run.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetUsersForActiveSync;
GO
CREATE PROCEDURE sp_GetUsersForActiveSync
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  UID,
            username,
            IsActive
    FROM    tbluser
    WHERE   username IS NOT NULL
      AND   LTRIM(RTRIM(username)) <> ''
      AND   ISNULL(IsActive, 1) = 1;   -- only check accounts currently marked active
END
GO

-- ---------------------------------------------------------------------------
-- sp_Active_Sync_AD_Log_Add
-- Sets tbluser.IsActive for one user AND records the change in the log table,
-- both inside a single transaction so they can't drift apart.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_Active_Sync_AD_Log_Add;
GO
CREATE PROCEDURE sp_Active_Sync_AD_Log_Add
    @UID      INT,
    @IsActive BIT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE tbluser
           SET IsActive = @IsActive
         WHERE UID = @UID;

        INSERT INTO dbo.tbl_Active_Sync_AD_Log (UID, [Datetime], IsActive_Value)
        VALUES (@UID, GETDATE(), @IsActive);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;   -- bubble up so the API's try/catch can log it to the audit trail
    END CATCH
END
GO
