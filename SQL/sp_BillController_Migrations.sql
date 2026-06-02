-- ============================================================================
-- sp_BillController_Migrations.sql
-- Stored procedures added to replace ALL inline SQL in BillController.
--
-- Inline SQL eliminated:
--   1. DELETE FROM tmp_bill_ids          → sp_ClearTmpBillIds
--   2. INSERT INTO tmp_bill_ids          → sp_InsertTmpBillId
--   3. SELECT * FROM tblStatus           → sp_GetAllStatuses
--   4. SELECT from vwPendingBills_new    → sp_SearchCloseBill
--   5. UPDATE/SELECT on tblBills (re-imburse per bill) → sp_ReimbursingBill_Item
--   6. UPDATE tblBills (status per bill) → sp_ChangeBillStatus_Item
--   7. UPDATE tblBills/tblCallRecord (re-assign per bill) → sp_ReAssigningBill_Item
--   8. INSERT into vwTblUser_tblMaster + vwTBLDetails_TBLMaster → sp_LogAuditAction
-- ============================================================================

-- ── 1. Clear tmp bill IDs ─────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_ClearTmpBillIds', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ClearTmpBillIds;
GO

CREATE PROCEDURE dbo.sp_ClearTmpBillIds
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM tmp_bill_ids;
END;
GO

-- ── 2. Insert single tmp bill ID ──────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_InsertTmpBillId', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_InsertTmpBillId;
GO

CREATE PROCEDURE dbo.sp_InsertTmpBillId
    @BillId INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO tmp_bill_ids VALUES (@BillId);
END;
GO

-- ── 3. Get all statuses (replaces: SELECT * FROM tblStatus) ──────────────────
IF OBJECT_ID('dbo.sp_GetAllStatuses', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetAllStatuses;
GO

CREATE PROCEDURE dbo.sp_GetAllStatuses
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, Name FROM tblStatus ORDER BY ID;
END;
GO

-- ── 4. Search closed bills ────────────────────────────────────────────────────
-- Replaces:
--   SELECT * FROM vwPendingBills_new WHERE status = 4
--   [AND month(billdate) = @Month] [AND year(billdate) = @Year]
--   [AND UID = @UID] [AND provider = @Provider]
IF OBJECT_ID('dbo.sp_SearchCloseBill', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_SearchCloseBill;
GO

CREATE PROCEDURE dbo.sp_SearchCloseBill
    @Month    INT = 0,
    @Year     INT = 0,
    @UID      INT = 0,
    @Provider INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        BILL_ID,
        BILLDATE,
        SUB_NO,
        EMPLOYEENAME,
        Appr_Manager,
        TOTALAMOUNT,
        STATUSNAME
    FROM vwPendingBills_new
    WHERE status = 4
      AND (@Month    = 0 OR MONTH(BILLDATE)  = @Month)
      AND (@Year     = 0 OR YEAR(BILLDATE)   = @Year)
      AND (@UID      = 0 OR UID              = @UID)
      AND (@Provider = 0 OR provider         = @Provider);
END;
GO

-- ── 5. Re-imburse a single bill ───────────────────────────────────────────────
-- Replaces:
--   SELECT ReimbursementAmount, DeductibleAmount, Status, WaiverAmount
--     FROM tblBills WHERE bill_id = @BillId
--   INSERT INTO vwTblUser_tblMaster ... (audit log success)
--   UPDATE tblBills SET ReimbursementAmount = DeductibleAmount + WaiverAmount,
--     DeductibleAmount = DeductibleAmount + WaiverAmount, Status = 1,
--     WaiverRejection = NULL, WaiverAmount = 0 WHERE Bill_ID = @BillId
IF OBJECT_ID('dbo.sp_ReimbursingBill_Item', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ReimbursingBill_Item;
GO

CREATE PROCEDURE dbo.sp_ReimbursingBill_Item
    @BillId INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Audit log — success
    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (13, 'Re-ImbursementBill', 'Success', @UserId);

    -- Apply re-imbursement
    UPDATE tblBills
    SET
        ReimbursementAmount = DeductibleAmount + WaiverAmount,
        DeductibleAmount    = DeductibleAmount + WaiverAmount,
        Status              = 1,
        WaiverRejection     = NULL,
        WaiverAmount        = 0
    WHERE Bill_ID = @BillId;
END;
GO

-- ── 6. Change bill status (single item) ──────────────────────────────────────
-- Replaces:
--   INSERT INTO vwTblUser_tblMaster ... (audit log success)
--   UPDATE tblBills SET status = @Status, comments = '',
--     DeductibleAmount = DeductibleAmount + WaiverAmount,
--     WaiverAmount = 0, WaiverRejection = NULL WHERE bill_id = @BillId
IF OBJECT_ID('dbo.sp_ChangeBillStatus_Item', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ChangeBillStatus_Item;
GO

CREATE PROCEDURE dbo.sp_ChangeBillStatus_Item
    @BillId INT,
    @Status INT,
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Audit log — success
    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (14, 'Change Bill Status', 'Success', @UserId);

    -- Apply status change + waiver collapse
    UPDATE tblBills
    SET
        status              = @Status,
        comments            = '',
        DeductibleAmount    = DeductibleAmount + WaiverAmount,
        WaiverAmount        = 0,
        WaiverRejection     = NULL
    WHERE bill_id = @BillId;
END;
GO

-- ── 7. Re-assign a single bill ────────────────────────────────────────────────
-- Replaces:
--   INSERT INTO vwTblUser_tblMaster ... (audit log success)
--   UPDATE tblBills SET UID = @NewUid,
--     LINEMANAGER = (SELECT ManagerID FROM tbluser WHERE UID = @NewUid),
--     ROUTEMANAGER = (SELECT ManagerID FROM tbluser WHERE UID = @NewUid)
--     WHERE bill_id = @BillId
--   UPDATE tblCallRecord SET AUID = @NewUid WHERE bill_id = @BillId
IF OBJECT_ID('dbo.sp_ReAssigningBill_Item', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_ReAssigningBill_Item;
GO

CREATE PROCEDURE dbo.sp_ReAssigningBill_Item
    @BillId    INT,
    @NewUid    INT,
    @LogUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ManagerId INT;
    SELECT @ManagerId = ManagerID FROM tbluser WHERE UID = @NewUid;

    -- Audit log — success
    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (15, 'Re-AssingBill', 'Success', @LogUserId);

    -- Re-assign bill owner and managers
    UPDATE tblBills
    SET
        UID          = @NewUid,
        LINEMANAGER  = @ManagerId,
        ROUTEMANAGER = @ManagerId
    WHERE bill_id = @BillId;

    -- Re-assign call records
    UPDATE tblCallRecord
    SET AUID = @NewUid
    WHERE bill_id = @BillId;
END;
GO

-- ── 8. Generic audit action logger ───────────────────────────────────────────
-- Replaces the two INSERT ... vwTblUser_tblMaster + vwTBLDetails_TBLMaster
-- patterns used in catch blocks of ReimbursingBill, ChangeBillStatus,
-- ReAssigningBill.
IF OBJECT_ID('dbo.sp_LogAuditAction', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_LogAuditAction;
GO

CREATE PROCEDURE dbo.sp_LogAuditAction
    @FormId     INT,
    @ActionName NVARCHAR(100),
    @Result     NVARCHAR(20),
    @UserId     INT,
    @ErrorText  NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Primary audit record
    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (@FormId, @ActionName, @Result, @UserId);

    -- Detail record (only when there is error text)
    IF @ErrorText IS NOT NULL AND LEN(@ErrorText) > 0
    BEGIN
        DECLARE @AtId INT;
        SELECT TOP 1 @AtId = ID
        FROM TBL_AT_MASTER
        ORDER BY date1 DESC;

        INSERT INTO [vwTBLDetails_TBLMaster]
            ([SNO], [AT_ID], [OLD_VALUE], [NEW_VALUE], [FIELD_NAME])
        VALUES
            (@FormId, @AtId, '', @ErrorText, @ActionName);
    END;
END;
GO

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- Run this script once against your TIS database to register all procedures.
-- ============================================================================
