-- =============================================================================
-- TIS – Additional Stored Procedures (Import, BAPI, helpers)
-- Run AFTER NewStoredProcedures.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- IMPORT – Get total import amount (was inline SELECT SUM from tblimport)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetImportTotalAmount;
GO
CREATE PROCEDURE sp_GetImportTotalAmount
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ROUND(SUM(amount), 3) FROM tblimport;
END
GO

-- ---------------------------------------------------------------------------
-- IMPORT – Get column mappings for bulk copy
-- Replaces inline SELECT excel_col1...9 from tblProvider
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetImportColumnMappings;
GO
CREATE PROCEDURE sp_GetImportColumnMappings
    @ProviderID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT [excel_col1], 'BillDateNew' AS [excel_col2],
           [excel_col3], [excel_col4], [excel_col5],
           [excel_col6], [excel_col7], [excel_col8], [excel_col9]
    FROM   tblProvider
    WHERE  id = @ProviderID;
END
GO

-- ---------------------------------------------------------------------------
-- IMPORT – Get unassigned bills (was inline SELECT on vw_Unassign_Grid)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetUnassignedBills;
GO
CREATE PROCEDURE sp_GetUnassignedBills
    @CountryID INT,
    @RoleID    INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @RoleID = 8
        SELECT * FROM [vw_Unassign_Grid];
    ELSE
        SELECT * FROM [vw_Unassign_Grid] WHERE CountryID = @CountryID;
END
GO

-- ---------------------------------------------------------------------------
-- IMPORT – Get all statuses (was inline SELECT * from tblStatus)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetAllStatuses;
GO
CREATE PROCEDURE sp_GetAllStatuses
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM tblStatus;
END
GO

-- ---------------------------------------------------------------------------
-- IMPORT – Get all policy rows (was inline SELECT on vwManageCalltype)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetAllPolicies;
GO
CREATE PROCEDURE sp_GetAllPolicies
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT id, Provider_type_desc, call_type, provider, providername,
           call_type_desc, destination_desc, IsAll, Superimpose_train, LineType, LineTypeName
    FROM   vwManageCalltype
    WHERE  isadmin = 1
    ORDER  BY provider, Provider_Type_Desc, Call_Type;
END
GO

-- ---------------------------------------------------------------------------
-- IMPORT – Load tmp_bill_ids for force-bill batch (was inline DELETE + INSERT loop)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_LoadTmpBillIds;
GO
CREATE PROCEDURE sp_LoadTmpBillIds
    @BillIds VARCHAR(MAX)   -- comma-separated list
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM tmp_bill_ids;

    INSERT INTO tmp_bill_ids (bill_ids)
    SELECT CAST(value AS INT)
    FROM   STRING_SPLIT(@BillIds, ',');
END
GO

-- ---------------------------------------------------------------------------
-- BAPI – Get shadow table for test sync (was inline SELECT on tblUser_BAPI)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetBapiShadowTable;
GO
CREATE PROCEDURE sp_GetBapiShadowTable
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM tblUser_BAPI;
END
GO

-- ---------------------------------------------------------------------------
-- BAPI – Mark SAP bill as posted (replaces inline UPDATE on TblBills)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_SapMarkBillPosted;
GO
CREATE PROCEDURE sp_SapMarkBillPosted
    @BillId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE TblBills
    SET    Posted = 'true', LastUpdatedON = GETDATE()
    WHERE  Bill_ID = @BillId;
END
GO

-- ---------------------------------------------------------------------------
-- BAPI – Insert SAP message log (replaces inline INSERT into msg)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_SapInsertMsg;
GO
CREATE PROCEDURE sp_SapInsertMsg
    @BillId  VARCHAR(50),
    @Message VARCHAR(MAX),
    @SentOn  VARCHAR(50),
    @Posted  VARCHAR(10),
    @Uid     VARCHAR(50),
    @Amount  DECIMAL(18, 4)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO msg (BillID, Messag, date1, Posted, UID, Amount)
    VALUES (@BillId, @Message, @SentOn, @Posted, @Uid, @Amount);
END
GO

-- ---------------------------------------------------------------------------
-- BAPI – Sync contractor data (replaces inline logic in UpdateContractor)
-- Body should replicate the original SELECT from View_tblEQL + upsert into tblUser
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_SyncContractorData;
GO
CREATE PROCEDURE sp_SyncContractorData
AS
BEGIN
    SET NOCOUNT ON;
    -- NOTE: This SP must be connected to the ContractorConnectionString via a linked server
    -- or populated by a scheduled ETL job. Placeholder implementation below:

    MERGE tblUser AS target
    USING (
        SELECT name + ' ' + surname AS EmpName,
               EMPUSERID            AS UID,
               Dept,
               TITLE
        FROM   View_tblEQL
        WHERE  EMPNO = '' OR EMPNO IS NULL
    ) AS source ON target.Username = source.UID
    WHEN MATCHED THEN
        UPDATE SET Org = REPLACE(source.Dept, '''', ''),
                   description = REPLACE(source.TITLE, '''', ''),
                   name = REPLACE(source.EmpName, '''', '')
    WHEN NOT MATCHED THEN
        INSERT (Uid, name, username, password, ManagerID, Org, email,
                description, SecManagerID, OrManagerID, CostCenter, Contractor)
        VALUES (123, REPLACE(source.EmpName,'',''), source.UID, '', 0,
                REPLACE(source.Dept,'',''), '', REPLACE(source.TITLE,'',''),
                0, 0, '', 1);
END
GO

-- ---------------------------------------------------------------------------
-- IMPORT – Reset tblImport before a new bulk copy
-- Replaces inline:  max(ID) from tblcallrecord  +  delete from tblImport
--                   +  DBCC CHECKIDENT (tblImport, RESEED, maxId)
-- Reseeds the identity so the next imported row continues after the highest
-- existing call-record ID (matches legacy importFirst behaviour exactly).
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ResetImportTable;
GO
CREATE PROCEDURE sp_ResetImportTable
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @maxId INT = (SELECT ISNULL(MAX(ID), 0) FROM tblcallrecord);
    DELETE FROM tblImport;
    DBCC CHECKIDENT (tblImport, RESEED, @maxId);
END
GO

PRINT 'Additional stored procedures created successfully.';
GO
