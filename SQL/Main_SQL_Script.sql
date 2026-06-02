-- =============================================================================
-- TIS — Setting module stored procedures
-- Replaces ALL inline SQL in Controllers/SettingController.cs.
-- Each procedure is idempotent (DROP IF EXISTS + CREATE).
--
-- Already-existing procs reused by SettingController (NOT redefined here):
--   sp_GetLineTypes, sp_DeletePolicy, sp_InsertAuditLog
--
-- NOTE on boolean columns: the legacy schema stores these flags as the text
-- 'True' / 'False' (the app persists bool.ToString()), so the bit-like params
-- below are NVARCHAR and the app passes "True"/"False" to preserve behaviour.
-- =============================================================================
-- =============================================================================
-- TIS – New Stored Procedures
-- Replaces ALL inline SQL that existed in the original controllers.
-- Each procedure is idempotent (DROP IF EXISTS + CREATE).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SHARED AUDIT LOG
-- Replaces direct inserts into vwTblUser_tblMaster / vwTBLDetails_TBLMaster
-- Called by every controller's LogAuditFail helper.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_InsertAuditLog;
GO
CREATE PROCEDURE sp_InsertAuditLog
    @FormId     INT,
    @ActionName VARCHAR(200),
    @Result     VARCHAR(50),
    @UserId     VARCHAR(50),
    @ErrorMsg   NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (@FormId, @ActionName, @Result, @UserId);

    IF @ErrorMsg IS NOT NULL
    BEGIN
        INSERT INTO vwTBLDetails_TBLMaster
               (SNO, AT_ID, OLD_VALUE, NEW_VALUE, FIELD_NAME)
        VALUES (
            @FormId,
            (SELECT ID FROM TBL_AT_MASTER WHERE date1 = (SELECT MAX(date1) FROM TBL_AT_MASTER)),
            '',
            @ErrorMsg,
            @ActionName
        );
    END
END
GO

-- ---------------------------------------------------------------------------
-- ADMIN – COUNTRY
-- Replaces inline INSERT / UPDATE / DELETE on TBLCOUNTRY
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_AddCountry;
GO
CREATE PROCEDURE sp_AddCountry
    @COUNTRYNAME  VARCHAR(200),
    @COUNTRYCODE  VARCHAR(20)  = NULL,
    @SHAYACODE    VARCHAR(50)  = NULL,
    @EXCHANGERATE DECIMAL(18,4),
    @CURRENCY     VARCHAR(20)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO TBLCOUNTRY (COUNTRYNAME, COUNTRYCODE, SHAYACODE, EXCHANGERATE, CURRENCY)
    VALUES (@COUNTRYNAME, @COUNTRYCODE, @SHAYACODE, @EXCHANGERATE, @CURRENCY);
END
GO

DROP PROCEDURE IF EXISTS sp_UpdateCountry;
GO
CREATE PROCEDURE sp_UpdateCountry
    @COUNTRYID    INT,
    @COUNTRYNAME  VARCHAR(200),
    @COUNTRYCODE  VARCHAR(20)  = NULL,
    @SHAYACODE    VARCHAR(50)  = NULL,
    @EXCHANGERATE DECIMAL(18,4),
    @CURRENCY     VARCHAR(20)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE TBLCOUNTRY
    SET    COUNTRYNAME  = @COUNTRYNAME,
           COUNTRYCODE  = @COUNTRYCODE,
           SHAYACODE    = @SHAYACODE,
           EXCHANGERATE = @EXCHANGERATE,
           CURRENCY     = @CURRENCY
    WHERE  COUNTRYID = @COUNTRYID;
END
GO

DROP PROCEDURE IF EXISTS sp_DeleteCountry;
GO
CREATE PROCEDURE sp_DeleteCountry
    @COUNTRYID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM TBLCOUNTRY WHERE COUNTRYID = @COUNTRYID;
END
GO

-- ---------------------------------------------------------------------------
-- ADMIN – MANAGER
-- Replaces inline INSERT into TBLUSER
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_AddManager;
GO
CREATE PROCEDURE sp_AddManager
    @NAME       VARCHAR(200),
    @EMPLOYEENO VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO TBLUSER (NAME, EMPLOYEENO) VALUES (@NAME, @EMPLOYEENO);
END
GO

-- ---------------------------------------------------------------------------
-- ADMIN – TELEPHONE DELETE
-- Replaces inline check + delete on tblSubscription_Number / tblAssignNo
-- Returns Result = 'succ' | 'Exist'
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_DeleteTelephone;
GO
CREATE PROCEDURE sp_DeleteTelephone
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM tblAssignNo WHERE Subs_no_ID = @ID)
    BEGIN
        SELECT 'Exist' AS Result;
        RETURN;
    END

    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (2, 'Update Telephone', 'Success', SYSTEM_USER);

    INSERT INTO vwTBLDetails_TBLMaster
           (SNO, AT_ID, OLD_VALUE, NEW_VALUE, FIELD_NAME)
    VALUES (
        2,
        (SELECT ID FROM TBL_AT_MASTER WHERE date1 = (SELECT MAX(date1) FROM TBL_AT_MASTER)),
        (SELECT sub_no FROM tblSubscription_Number WHERE ID = @ID),
        '',
        'Update Telephone'
    );

    DELETE FROM tblSubscription_Number WHERE ID = @ID;

    SELECT 'succ' AS Result;
END
GO

-- ---------------------------------------------------------------------------
-- ADMIN – ASSIGNMENT DELETE
-- Replaces inline DELETE on tblAssignNo + audit insert
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_DeleteAssignNumber;
GO
CREATE PROCEDURE sp_DeleteAssignNumber
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (2, 'Delete Assign No.', 'Success', SYSTEM_USER);

    DELETE FROM tblAssignNo WHERE ID = @ID;
END
GO

-- ---------------------------------------------------------------------------
-- ADMIN – CONTACT SAVE
-- Replaces inline INSERT / UPDATE on tblContact
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_SaveContact;
GO
CREATE PROCEDURE sp_SaveContact
    @Uid       INT,
    @Name      VARCHAR(200) = NULL,
    @DialledNo VARCHAR(50)  = NULL,
    @ExName    VARCHAR(200) = NULL   -- non-null = update
AS
BEGIN
    SET NOCOUNT ON;

    IF @ExName IS NOT NULL
    BEGIN
        UPDATE tblContact SET [Name] = @Name WHERE [Uid] = @Uid;
    END
    ELSE
    BEGIN
        INSERT INTO tblContact ([DialledNo], [Name], [Uid])
        VALUES (@DialledNo, @Name, @Uid);
    END
END
GO

-- ---------------------------------------------------------------------------
-- ADMIN – DATA ROAMING DELETE
-- Replaces inline DELETE on tblDataRoaming
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_DeleteDataRoaming;
GO
CREATE PROCEDURE sp_DeleteDataRoaming
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM tblDataRoaming WHERE ID = @ID;
END
GO

-- ---------------------------------------------------------------------------
-- ADMIN – GET ALL PACKAGES (was inline SELECT * FROM TBL_PKG_MASTER)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetAllPackages;
GO
CREATE PROCEDURE sp_GetAllPackages
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, PKGNAME, DESCRIPTION, STARTDATE FROM TBL_PKG_MASTER;
END
GO

-- ---------------------------------------------------------------------------
-- ADMIN – FILL TRANS TYPE (was inline SELECT on TBL_PKGCALLTYPE)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetPackageTransTypes;
GO
CREATE PROCEDURE sp_GetPackageTransTypes
    @ProviderID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, PKG_CALLTYPE
    FROM   TBL_PKGCALLTYPE
    WHERE  PROVIDER = @ProviderID
    ORDER  BY PKG_CALLTYPE;
END
GO

-- ---------------------------------------------------------------------------
-- ADMIN – FILL DESC (was inline SELECT on TBL_PKGCALLDESC)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetPackageCallDescs;
GO
CREATE PROCEDURE sp_GetPackageCallDescs
    @TransID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, CALLTYPEDESC
    FROM   TBL_PKGCALLDESC
    WHERE  CALLTYPEID = @TransID
    ORDER  BY CALLTYPEDESC;
END
GO

-- ---------------------------------------------------------------------------
-- AUDIT REPORT – SEARCH
-- Replaces inline SELECT on TBL_AT_MASTER with string concatenation
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_AuditReportSearch;
GO
CREATE PROCEDURE sp_AuditReportSearch
    @StartDate DATETIME,
    @EndDate   DATETIME,
    @Event     INT,
    @Uid       VARCHAR(50),
    @Status    VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT m.ID,
           m.ACTION_NAME,
           m.RESULT,
           u.Name AS [USER],
           m.USERID,
           m.DATE1,
           m.FORM_ID
    FROM   TBL_AT_MASTER m
    LEFT   JOIN tbluser u ON u.uid = TRY_CAST(m.USERID AS INT)
    WHERE  m.DATE1   BETWEEN @StartDate AND @EndDate
      AND  m.FORM_ID = @Event
      AND  m.USERID  = @Uid
      AND  m.RESULT  = @Status;
END
GO

-- ---------------------------------------------------------------------------
-- AUDIT REPORT – DETAILS
-- Replaces inline SELECT on TBL_AT_DETAILS
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_AuditReportDetails;
GO
CREATE PROCEDURE sp_AuditReportDetails
    @AtId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, SNO, AT_ID, OLD_VALUE, NEW_VALUE, FIELD_NAME
    FROM   TBL_AT_DETAILS
    WHERE  AT_ID = @AtId;
END
GO

-- ---------------------------------------------------------------------------
-- AUDIT REPORT – GET ALL EMPLOYEES (was inline SELECT on tbluser)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetAllEmployeesForAudit;
GO
CREATE PROCEDURE sp_GetAllEmployeesForAudit
AS
BEGIN
    SET NOCOUNT ON;
    SELECT uid, username, name, EMPLOYEENO FROM tbluser;
END
GO

-- ---------------------------------------------------------------------------
-- BILL – SEARCH CLOSE BILLS
-- Replaces dynamic inline SQL in BillController.SearchCloseBill
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_SearchCloseBill;
GO
CREATE PROCEDURE sp_SearchCloseBill
    @Month    INT = 0,
    @Year     INT = 0,
    @Uid      INT = 0,
    @Provider INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM   vwPendingBills_new
    WHERE  status = 4
      AND  (@Month    = 0 OR MONTH(billdate) = @Month)
      AND  (@Year     = 0 OR YEAR(billdate)  = @Year)
      AND  (@Uid      = 0 OR UID             = @Uid)
      AND  (@Provider = 0 OR provider        = @Provider);
END
GO

-- ---------------------------------------------------------------------------
-- BILL REPORT – SEARCH
-- Replaces dynamic inline SQL in BillReportController.Search
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_BillReportSearch;
GO
CREATE PROCEDURE sp_BillReportSearch
    @Month     INT = 0,
    @Year      INT = 0,
    @Status    INT = 0,   -- 1 = all non-closed, 4 = closed only
    @CompanyId INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM   vwPendingBills
    WHERE  1 = 1
      AND  (@Month     = 0 OR MONTH(billdate) = @Month)
      AND  (@Year      = 0 OR YEAR(billdate)  = @Year)
      AND  (@Status    = 0
            OR (@Status = 1 AND status <> 4)
            OR (@Status = 4 AND status  = 4))
      AND  (@CompanyId = 0 OR CompanyID  = @CompanyId)
      AND  CompanyID > 0;
END
GO

-- ---------------------------------------------------------------------------
-- REPORT – SEARCH
-- Replaces dynamic inline SQL in ReportController.Search
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReportSearch;
GO
CREATE PROCEDURE sp_ReportSearch
    @Month    INT = 0,
    @Year     INT = 0,
    @Status   INT = 0,
    @Provider INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM   vwPendingBills
    WHERE  1 = 1
      AND  (@Month    = 0 OR MONTH(billdate) = @Month)
      AND  (@Year     = 0 OR YEAR(billdate)  = @Year)
      AND  (@Status   = 0
            OR (@Status = 1 AND status <> 4)
            OR (@Status = 4 AND status  = 4))
      AND  (@Provider = 0 OR provider        = @Provider);
END
GO

-- ---------------------------------------------------------------------------
-- BILL – RE-IMBURSE BILL
-- Replaces inline SELECT + UPDATE in BillController.ReimbursingBill
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReimbursingBill;
GO
CREATE PROCEDURE sp_ReimbursingBill
    @BillId INT,
    @UserId VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (13, 'Re-ImbursementBill', 'Success', @UserId);

    UPDATE tblBills
    SET    ReimbursementAmount = DeductibleAmount + WaiverAmount,
           DeductibleAmount    = DeductibleAmount + WaiverAmount,
           Status              = 1,
           WaiverRejection     = NULL,
           WaiverAmount        = 0
    WHERE  Bill_ID = @BillId;
END
GO

-- ---------------------------------------------------------------------------
-- BILL – CHANGE BILL STATUS (individual)
-- Replaces inline UPDATE in BillController.ChangeBillStatus
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ChangeBillStatusBatch;
GO
CREATE PROCEDURE sp_ChangeBillStatusBatch
    @BillId INT,
    @Status INT,
    @UserId VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (14, 'Change Bill Status', 'Success', @UserId);

    UPDATE tblBills
    SET    status          = @Status,
           comments        = '',
           DeductibleAmount= DeductibleAmount + WaiverAmount,
           WaiverAmount    = 0,
           WaiverRejection = NULL
    WHERE  bill_id = @BillId;
END
GO

-- ---------------------------------------------------------------------------
-- BILL – RE-ASSIGN BILL
-- Replaces inline UPDATE in BillController.ReAssigningBill
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReAssignBillBatch;
GO
CREATE PROCEDURE sp_ReAssignBillBatch
    @BillId INT,
    @NewUid INT,
    @UserId VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (15, 'Re-AssingBill', 'Success', @UserId);

    UPDATE tblBills
    SET    UID          = @NewUid,
           LINEMANAGER  = (SELECT ManagerID FROM tbluser WHERE UID = @NewUid),
           ROUTEMANAGER = (SELECT ManagerID FROM tbluser WHERE UID = @NewUid)
    WHERE  bill_id = @BillId;

    UPDATE tblCallRecord
    SET    AUID = @NewUid
    WHERE  bill_id = @BillId;
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – FILL TRANS TYPE
-- Replaces inline SELECT on tblCallRecord
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetCallRecordTransTypes;
GO
CREATE PROCEDURE sp_GetCallRecordTransTypes
    @ProviderID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT TRANS_TYPE
    FROM   tblCallRecord
    WHERE  Provider_Type = @ProviderID
    ORDER  BY TRANS_TYPE;
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – FILL DESC
-- Replaces inline SELECT on TBLCALLRECORD
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetCallRecordDescriptions;
GO
CREATE PROCEDURE sp_GetCallRecordDescriptions
    @TransType  VARCHAR(200),
    @ProviderID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT [DESCRIPTION]
    FROM   TBLCALLRECORD
    WHERE  [TRANS_TYPE]   = @TransType
      AND  PROVIDER_TYPE  = @ProviderID
    ORDER  BY [DESCRIPTION];
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – GET CALL TYPE (was inline SELECT on tblCallType)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetCallTypes;
GO
CREATE PROCEDURE sp_GetCallTypes
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, Name FROM tblCallType WHERE ID <> 0;
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – GET EMPLOYEE (for policy mapping; was inline SELECT on vwEmpCallID)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetEmpCallId;
GO
CREATE PROCEDURE sp_GetEmpCallId
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UID, NAME, Subs_no_ID, SUB_NO, ORG
    FROM   vwEmpCallID
    ORDER  BY NAME, ORG;
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – GET POLICY DETAIL (was inline SELECT on tblManageCallTypeDetail)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetPolicyDetail;
GO
CREATE PROCEDURE sp_GetPolicyDetail
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Sub_No_ID FROM tblManageCallTypeDetail WHERE ManageCallTypeID = @ID;
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – GET EMP LIST FOR POLICY (was inline SELECT joining TBLUSER / TBLASSIGNNO)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetPolicyEmpList;
GO
CREATE PROCEDURE sp_GetPolicyEmpList
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT NAME, EMPLOYEENO
    FROM   TBLUSER
    WHERE  UID IN (
               SELECT UID FROM TBLASSIGNNO
               WHERE  Subs_no_ID IN (
                          SELECT SUB_NO_ID FROM tblManageCallTypeDetail
                          WHERE  ManageCallTypeID = @ID
                      )
           );
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – GET CONFIG (was inline SELECT on tblConfiguration)
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetConfig;
GO
CREATE PROCEDURE sp_GetConfig
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 * FROM tblConfiguration WHERE ID = 1;
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – SAVE CONFIG
-- Replaces massive inline UPDATE on tblConfiguration
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_SaveConfig;
GO
CREATE PROCEDURE sp_SaveConfig
    @EmpReminder        VARCHAR(50),
    @MgrReminder        VARCHAR(50),
    @FbReminder         VARCHAR(50),
    @LmReminder         VARCHAR(50),
    @Smtp               VARCHAR(200),
    @AdminEmail         VARCHAR(200),
    @HostUrl            VARCHAR(500),
    @SupGrade           VARCHAR(50),
    @EnableGrade        BIT,
    @DntSndEmail        BIT,
    @HidePerCalls       BIT,
    @GmApp              BIT,
    @EnableDiscrepancy  BIT,
    @SkipAppBusZero     BIT,
    @DedBusCharges      BIT,
    @ZeroUnlimited      BIT,
    @AlwWav             BIT,
    @EnableDelete       BIT,
    @AlwTrainFb         BIT,
    @HideAllowanceLimit BIT,
    @HidePersonalLimit  BIT,
    @UserId             VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (17, 'Configuration', 'Success', @UserId);

    UPDATE tblConfiguration
    SET    EmpReminder            = @EmpReminder,
           MgrComplaintReminder   = @MgrReminder,
           ForceBillReminder      = @FbReminder,
           LMReminder             = @LmReminder,
           SMTPSettings           = @Smtp,
           AdminEmail             = @AdminEmail,
           HostUrl                = @HostUrl,
           SuperGrade             = @SupGrade,
           EnableGrade            = @EnableGrade,
           NotSendMail            = @DntSndEmail,
           HidePersonalCalls      = @HidePerCalls,
           skipGMApproval         = @GmApp,
           EnableDiscrepancy      = @EnableDiscrepancy,
           SkipApprovalBuss       = @SkipAppBusZero,
           DedBussinessCharges    = @DedBusCharges,
           BusinessZeroAsUnlimited= @ZeroUnlimited,
           AllowWaiver            = @AlwWav,
           DeleteBut              = @EnableDelete,
           AllowTrainForceBill    = @AlwTrainFb,
           HideAllowanceLimit     = @HideAllowanceLimit,
           HidePersonalLimit      = @HidePersonalLimit
    WHERE  ID = 1;
END
GO





DROP PROCEDURE IF EXISTS sp_UpdateProvider;
GO
CREATE PROCEDURE sp_UpdateProvider
    @ID     INT,
    @Name   VARCHAR(200),
    @IsVoip BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE tblProvider SET Name = @Name, IsVoip = @IsVoip WHERE ID = @ID;
END
GO

DROP PROCEDURE IF EXISTS sp_DeleteProvider;
GO
CREATE PROCEDURE sp_DeleteProvider
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM tblProvider WHERE ID = @ID;
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – ADD POLICY
-- Replaces inline INSERT on tblManageCalltype + tblManageCallTypeDetail
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_AddPolicy;
GO
CREATE PROCEDURE sp_AddPolicy
    @ProviderID   INT,
    @TransType    VARCHAR(200),
    @Destination  VARCHAR(200) = NULL,
    @CallTypeID   INT,
    @IsAll        BIT,
    @IsSupImp     BIT,
    @LineTypeID   INT,
    @IsAllDesc    BIT,
    @EmpIds       VARCHAR(MAX) = NULL,  -- comma-separated UIDs
    @NumIds       VARCHAR(MAX) = NULL,  -- comma-separated Subs_no_IDs
    @UserId       VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (18, 'Add Policy', 'Success', @UserId);

    DECLARE @NewId INT = ISNULL((SELECT MAX(ID) FROM tblManageCallType), 0) + 1;

    IF @IsAllDesc = 1
    BEGIN
        INSERT INTO tblManageCalltype
               (id, provider, Provider_type_desc, destination_desc, call_type, IsAll, Superimpose_train, IsAdmin, LineType)
        VALUES (@NewId, @ProviderID, @TransType, '', @CallTypeID, @IsAll, @IsSupImp, 1, @LineTypeID);
    END
    ELSE
    BEGIN
        INSERT INTO tblManageCalltype
               (id, provider, Provider_type_desc, destination_desc, call_type, IsAll, Superimpose_train, IsAdmin, LineType)
        VALUES (@NewId, @ProviderID, @TransType, @Destination, @CallTypeID, @IsAll, @IsSupImp, 1, @LineTypeID);
    END

    -- Insert employee/number detail rows when not IsAll
    IF @IsAll = 0 AND @EmpIds IS NOT NULL
    BEGIN
        INSERT INTO tblManageCallTypeDetail (uid, sub_no_id, ManageCallTypeID)
        SELECT value,
               CAST(SUBSTRING(@NumIds, CHARINDEX(',', @NumIds + ',', n.rn), CHARINDEX(',', @NumIds + ',', n.rn + 1) - CHARINDEX(',', @NumIds + ',', n.rn)) AS INT),
               @NewId
        FROM   STRING_SPLIT(@EmpIds, ',') s
        CROSS  APPLY (SELECT CHARINDEX(s.value, @EmpIds) AS rn) n;
    END
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – UPDATE POLICY
-- Replaces inline UPDATE/DELETE on tblManageCalltype + tblManageCallTypeDetail
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_UpdatePolicy;
GO
CREATE PROCEDURE sp_UpdatePolicy
    @ID       INT,
    @IsAll    BIT,
    @IsSupImp BIT,
    @EmpIds   VARCHAR(MAX) = NULL,
    @NumIds   VARCHAR(MAX) = NULL,
    @UserId   VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
    VALUES (18, 'Update Policy', 'Success', @UserId);

    UPDATE tblManageCalltype
    SET    IsAll = @IsAll, Superimpose_train = @IsSupImp
    WHERE  id = @ID;

    DELETE FROM tblManageCallTypeDetail WHERE ManageCallTypeID = @ID;

    IF @IsAll = 0 AND @EmpIds IS NOT NULL
    BEGIN
        INSERT INTO tblManageCallTypeDetail (uid, sub_no_id, ManageCallTypeID)
        SELECT CAST(e.[value] AS INT),
               CAST(n.[value] AS INT),
               @ID
        FROM   OPENJSON('["' + REPLACE(@EmpIds, ',', '","') + '"]') e
        JOIN   OPENJSON('["' + REPLACE(@NumIds, ',', '","') + '"]') n
               ON e.[key] = n.[key];
    END
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – APPLY POLICY
-- Replaces inline UPDATE on M6_CR
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ApplyPolicy;
GO
CREATE PROCEDURE sp_ApplyPolicy
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE M6_CR SET [CALL_TYPE] = [new_CALL_TYPE], islocked = NEW_ISLOCKED;
END
GO

-- ---------------------------------------------------------------------------
-- SETTING – GET PROVIDER (for CheckProvider in ImportController)
-- Replaces inline SELECT DbBased FROM tblProvider
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetProviderDbBased;
GO
CREATE PROCEDURE sp_GetProviderDbBased
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DbBased FROM tblProvider WHERE ID = @ID;
END
GO

-- ---------------------------------------------------------------------------
-- IMPORT – GET UPLOAD SETTING
-- Replaces inline SELECT * FROM tblProvider WHERE ID
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetUploadSetting;
GO
CREATE PROCEDURE sp_GetUploadSetting
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT excel_col1, excel_col2, excel_col3, excel_col4,
           excel_col5, excel_col6, excel_col7, excel_col8,
           DbBased, dbConstr, dbTableName
    FROM   tblProvider
    WHERE  ID = @ID;
END
GO

-- ---------------------------------------------------------------------------
-- IMPORT – UPDATE IMPORT RECORD
-- Replaces inline UPDATE on tblImport + SELECT of null rows
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_UpdateImportRecord;
GO
CREATE PROCEDURE sp_UpdateImportRecord
    @ID       INT,
    @Amount   VARCHAR(50),
    @SubNo    VARCHAR(50),
    @CallDate DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE tblImport
    SET    AMOUNT     = @Amount,
           SUB_NO     = @SubNo,
           BILLNUMBER = @SubNo,
           CALLDATE   = @CallDate
    WHERE  ID = @ID;

    -- Return rows still containing nulls
    SELECT ID, SUB_NO, BILLDATE, CALLDATE, TRANS_TYPE,
           DESCRIPTION, AMOUNT, DURATION, CALLTIME
    FROM   tblImport
    WHERE  SUB_NO IS NULL OR CALLDATE IS NULL OR AMOUNT IS NULL;
END
GO

-- ---------------------------------------------------------------------------
-- PIVOT – SAVE PIVOT STATE
-- Replaces inline INSERT into tblPivot
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_SavePivot;
GO
CREATE PROCEDURE sp_SavePivot
    @Object NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO tblPivot (Object, Date) VALUES (@Object, GETDATE());
END
GO

-- ---------------------------------------------------------------------------
-- PIVOT – RESTORE PIVOT STATE
-- Replaces inline SELECT TOP 1 Object FROM tblPivot
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_RestorePivot;
GO
CREATE PROCEDURE sp_RestorePivot
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 Object FROM tblPivot ORDER BY Date DESC;
END
GO

-- ---------------------------------------------------------------------------
-- SAP PENDING – MARK AS POSTED
-- Already used sp_SAP_MarkAsPosted – kept for reference, no change needed.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- SEND EMAIL – REMINDER HELPERS
-- Replaces calls to stored procs that were triggered from void methods
-- (no body change needed – listing for completeness)
-- sp_BillIdentification_Reminder  -- existing
-- sp_ForceBill_Reminder           -- existing
-- sp_SetForceBill_ReminderNew     -- existing
-- sp_SetBill_ReminderNew          -- existing
-- SP_BillApprovalReminder_New     -- existing
-- sp_GetPendingEmail              -- existing
-- ---------------------------------------------------------------------------

PRINT 'All new stored procedures created successfully.';
GO

-- ── Providers ───────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_GetProviders;
GO
CREATE PROCEDURE sp_GetProviders
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, Name, IsVoip, COUNTRYID FROM tblProvider ORDER BY Name;
END
GO

DROP PROCEDURE IF EXISTS sp_AddProvider;
GO
CREATE PROCEDURE sp_AddProvider
    @Name   NVARCHAR(200),
    @IsVoip NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO tblProvider (Name, IsVoip) VALUES (@Name, @IsVoip);
END
GO

DROP PROCEDURE IF EXISTS sp_UpdateProvider;
GO
CREATE PROCEDURE sp_UpdateProvider
    @ID     INT,
    @Name   NVARCHAR(200),
    @IsVoip NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE tblProvider SET Name = @Name, IsVoip = @IsVoip WHERE ID = @ID;
END
GO

DROP PROCEDURE IF EXISTS sp_DeleteProvider;
GO
CREATE PROCEDURE sp_DeleteProvider
    @ID INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM tblProvider WHERE ID = @ID;
END
GO


-- ── Configuration (single row, ID = 1) ───────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_GetConfiguration;
GO
CREATE PROCEDURE sp_GetConfiguration
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM tblConfiguration WHERE ID = 1;
END
GO

DROP PROCEDURE IF EXISTS sp_SaveConfiguration;
GO
CREATE PROCEDURE sp_SaveConfiguration
    @EmpReminder        NVARCHAR(50),
    @MgrReminder        NVARCHAR(50),
    @FbReminder         NVARCHAR(50),
    @LmReminder         NVARCHAR(50),
    @Smtp               NVARCHAR(255),
    @AdminEmail         NVARCHAR(255),
    @HostUrl            NVARCHAR(255),
    @SupGrade           NVARCHAR(50),
    @EnableGrade        NVARCHAR(10),
    @DntSndEmail        NVARCHAR(10),
    @HidePerCalls       NVARCHAR(10),
    @GmApp              NVARCHAR(10),
    @EnableDiscrepancy  NVARCHAR(10),
    @SkipAppBusZero     NVARCHAR(10),
    @DedBusCharges      NVARCHAR(10),
    @ZeroUnlimited      NVARCHAR(10),
    @AlwWav             NVARCHAR(10),
    @EnableDelete       NVARCHAR(10),
    @AlwTrainFb         NVARCHAR(10),
    @HideAllowanceLimit NVARCHAR(10),
    @HidePersonalLimit  NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE tblConfiguration SET
        EmpReminder             = @EmpReminder,
        MgrComplaintReminder    = @MgrReminder,
        ForceBillReminder       = @FbReminder,
        LMReminder              = @LmReminder,
        SMTPSettings            = @Smtp,
        AdminEmail              = @AdminEmail,
        HostUrl                 = @HostUrl,
        SuperGrade              = @SupGrade,
        EnableGrade             = @EnableGrade,
        NotSendMail             = @DntSndEmail,
        HidePersonalCalls       = @HidePerCalls,
        skipGMApproval          = @GmApp,
        EnableDiscrepancy       = @EnableDiscrepancy,
        SkipApprovalBuss        = @SkipAppBusZero,
        DedBussinessCharges     = @DedBusCharges,
        BusinessZeroAsUnlimited = @ZeroUnlimited,
        AllowWaiver             = @AlwWav,
        DeleteBut               = @EnableDelete,
        AllowTrainForceBill     = @AlwTrainFb,
        HideAllowanceLimit      = @HideAllowanceLimit,
        HidePersonalLimit       = @HidePersonalLimit
    WHERE ID = 1;
END
GO


-- ── Policy lookups ───────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_GetTransTypes;
GO
CREATE PROCEDURE sp_GetTransTypes
    @ProviderId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT TRANS_TYPE
    FROM   tblCallRecord
    WHERE  Provider_Type = @ProviderId
    ORDER  BY TRANS_TYPE;
END
GO

DROP PROCEDURE IF EXISTS sp_GetDescriptions;
GO
CREATE PROCEDURE sp_GetDescriptions
    @ProviderId INT,
    @TransType  NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT [DESCRIPTION]
    FROM   TBLCALLRECORD
    WHERE  [TRANS_TYPE] = @TransType
      AND  PROVIDER_TYPE = @ProviderId
    ORDER  BY [DESCRIPTION];
END
GO

DROP PROCEDURE IF EXISTS sp_GetCallTypes;
GO
CREATE PROCEDURE sp_GetCallTypes
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM tblCallType WHERE ID <> 0;
END
GO

DROP PROCEDURE IF EXISTS sp_GetEmpCallId;
GO
CREATE PROCEDURE sp_GetEmpCallId
AS
BEGIN
    SET NOCOUNT ON;
    SELECT UID, NAME, Subs_no_ID, SUB_NO, ORG
    FROM   vwEmpCallID
    ORDER  BY NAME, ORG;
END
GO


-- ── Policy grid / CRUD ───────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS sp_GetPolicies;
GO
CREATE PROCEDURE sp_GetPolicies
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

-- Inserts a policy header row, computing the next ID, and returns it as NewId.
DROP PROCEDURE IF EXISTS sp_InsertPolicy;
GO
CREATE PROCEDURE sp_InsertPolicy
    @ProviderId       INT,
    @TransType        NVARCHAR(255),
    @DestinationDesc  NVARCHAR(255),
    @CallTypeId       INT,
    @IsAll            NVARCHAR(10),
    @IsSupImp         NVARCHAR(10),
    @LineTypeId       INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id INT = ISNULL((SELECT MAX(ID) FROM tblManageCallType), 0) + 1;

    INSERT INTO tblManageCalltype
        (id, provider, Provider_type_desc, destination_desc, call_type,
         IsAll, Superimpose_train, IsAdmin, LineType)
    VALUES
        (@id, @ProviderId, @TransType, @DestinationDesc, @CallTypeId,
         @IsAll, @IsSupImp, 'true', @LineTypeId);

    SELECT @id AS NewId;
END
GO

DROP PROCEDURE IF EXISTS sp_InsertPolicyDetail;
GO
CREATE PROCEDURE sp_InsertPolicyDetail
    @Uid              INT,
    @SubNoId          INT,
    @ManageCallTypeId INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO tblManageCallTypeDetail (uid, sub_no_id, ManageCallTypeID)
    VALUES (@Uid, @SubNoId, @ManageCallTypeId);
END
GO

-- Updates the header flags and clears its employee details (caller re-inserts).
DROP PROCEDURE IF EXISTS sp_UpdatePolicyHeader;
GO
CREATE PROCEDURE sp_UpdatePolicyHeader
    @Id       INT,
    @IsAll    NVARCHAR(10),
    @IsSupImp NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE tblManageCalltype
    SET    IsAll = @IsAll, Superimpose_train = @IsSupImp
    WHERE  id = @Id;

    DELETE FROM tblManageCallTypeDetail WHERE ManageCallTypeID = @Id;
END
GO

DROP PROCEDURE IF EXISTS sp_ApplyPolicy;
GO
CREATE PROCEDURE sp_ApplyPolicy
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE M6_CR SET [CALL_TYPE] = [new_CALL_TYPE], islocked = NEW_ISLOCKED;
END
GO

DROP PROCEDURE IF EXISTS sp_GetPolicyDetail;
GO
CREATE PROCEDURE sp_GetPolicyDetail
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Sub_No_ID FROM tblManageCallTypeDetail WHERE ManageCallTypeID = @Id;
END
GO

DROP PROCEDURE IF EXISTS sp_GetPolicyEmployees;
GO
CREATE PROCEDURE sp_GetPolicyEmployees
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT NAME, EMPLOYEENO
    FROM   TBLUSER
    WHERE  UID IN (
        SELECT UID FROM TBLASSIGNNO
        WHERE Subs_no_ID IN (
            SELECT SUB_NO_ID FROM tblManageCallTypeDetail WHERE ManageCallTypeID = @Id
        )
    );
END
GO

PRINT 'Setting stored procedures created successfully.';
GO

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

