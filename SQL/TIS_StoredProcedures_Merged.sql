-- =============================================================================
-- TIS.NET10 — Consolidated Stored Procedures (single execution script)
-- -----------------------------------------------------------------------------
-- Merged from: Main_SQL_Script.sql, NewStoredProcedures.sql,
--              AdditionalStoredProcedures.sql, sp_BillController_Migrations.sql
-- Every procedure is defined exactly once and is idempotent (DROP IF EXISTS +
-- CREATE). Safe to re-run. Conflicting duplicate definitions were resolved to
-- the version that matches the .NET 10 controller calls.
-- =============================================================================
SET NOCOUNT ON;
GO

-- ---------------------------------------------------------------------------
-- sp_InsertAuditLog
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
-- sp_AddCountry
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

-- ---------------------------------------------------------------------------
-- sp_UpdateCountry
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- sp_DeleteCountry
-- ---------------------------------------------------------------------------
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
-- sp_AddManager
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
-- sp_DeleteTelephone
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
-- sp_DeleteAssignNumber
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
-- sp_SaveContact
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
-- sp_DeleteDataRoaming
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
-- sp_GetAllPackages
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
-- sp_GetPackageTransTypes
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
-- sp_GetPackageCallDescs
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
-- sp_AuditReportSearch
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
-- sp_AuditReportDetails
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
-- sp_GetAllEmployeesForAudit
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
-- sp_SearchCloseBill
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_SearchCloseBill;
GO
CREATE PROCEDURE sp_SearchCloseBill
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

-- ---------------------------------------------------------------------------
-- sp_BillReportSearch
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
-- sp_ReportSearch
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
-- sp_ReimbursingBill
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
-- sp_ChangeBillStatusBatch
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
-- sp_ReAssignBillBatch
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
-- sp_GetCallRecordTransTypes
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
-- sp_GetCallRecordDescriptions
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
-- sp_GetCallTypes
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
-- sp_GetEmpCallId
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
-- sp_GetPolicyDetail
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
-- sp_GetPolicyEmpList
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
-- sp_GetConfig
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
-- sp_SaveConfig
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

-- ---------------------------------------------------------------------------
-- sp_UpdateProvider
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_UpdateProvider;
GO
CREATE PROCEDURE sp_UpdateProvider
    @ID     INT,
    @Name   NVARCHAR(200),
    @IsVoip BIT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE tblProvider SET Name = @Name, IsVoip = @IsVoip WHERE ID = @ID;
END
GO

-- ---------------------------------------------------------------------------
-- sp_DeleteProvider
-- ---------------------------------------------------------------------------
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
-- sp_AddPolicy
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
-- sp_UpdatePolicy
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
-- sp_ApplyPolicy
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
-- sp_GetProviderDbBased
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
-- sp_GetUploadSetting
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
-- sp_UpdateImportRecord
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
-- sp_SavePivot
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
-- sp_RestorePivot
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
-- sp_GetProviders
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetProviders;
GO
CREATE PROCEDURE sp_GetProviders
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, Name, IsVoip, COUNTRYID FROM tblProvider ORDER BY Name;
END
GO

-- ---------------------------------------------------------------------------
-- sp_AddProvider
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_AddProvider;
GO
CREATE PROCEDURE sp_AddProvider
    @Name   NVARCHAR(200),
    @IsVoip BIT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO tblProvider (Name, IsVoip) VALUES (@Name, @IsVoip);
END
GO

-- ---------------------------------------------------------------------------
-- sp_GetConfiguration
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetConfiguration;
GO
CREATE PROCEDURE sp_GetConfiguration
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM tblConfiguration WHERE ID = 1;
END
GO

-- ---------------------------------------------------------------------------
-- sp_SaveConfiguration
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- sp_GetTransTypes
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- sp_GetDescriptions
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- sp_GetPolicies
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- sp_InsertPolicy
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- sp_InsertPolicyDetail
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- sp_UpdatePolicyHeader
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- sp_GetPolicyEmployees
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- sp_ClearTmpBillIds
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ClearTmpBillIds;
GO
CREATE PROCEDURE sp_ClearTmpBillIds
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM tmp_bill_ids;
END;
GO

-- ---------------------------------------------------------------------------
-- sp_InsertTmpBillId
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_InsertTmpBillId;
GO
CREATE PROCEDURE sp_InsertTmpBillId
    @BillId INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO tmp_bill_ids VALUES (@BillId);
END;
GO

-- ---------------------------------------------------------------------------
-- sp_GetAllStatuses
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetAllStatuses;
GO
CREATE PROCEDURE sp_GetAllStatuses
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, Name FROM tblStatus ORDER BY ID;
END
GO

-- ---------------------------------------------------------------------------
-- sp_ReimbursingBill_Item
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReimbursingBill_Item;
GO
CREATE PROCEDURE sp_ReimbursingBill_Item
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

-- ---------------------------------------------------------------------------
-- sp_ChangeBillStatus_Item
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ChangeBillStatus_Item;
GO
CREATE PROCEDURE sp_ChangeBillStatus_Item
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

-- ---------------------------------------------------------------------------
-- sp_ReAssigningBill_Item
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_ReAssigningBill_Item;
GO
CREATE PROCEDURE sp_ReAssigningBill_Item
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

-- ---------------------------------------------------------------------------
-- sp_LogAuditAction
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_LogAuditAction;
GO
CREATE PROCEDURE sp_LogAuditAction
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

-- ---------------------------------------------------------------------------
-- sp_GetImportTotalAmount
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
-- sp_GetImportColumnMappings
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
-- sp_GetUnassignedBills
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
-- sp_GetAllPolicies
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
-- sp_LoadTmpBillIds
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
-- sp_GetBapiShadowTable
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
-- sp_SapMarkBillPosted
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
-- sp_SapInsertMsg
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
-- sp_SyncContractorData
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
-- sp_ResetImportTable
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

-- ---------------------------------------------------------------------------
-- sp_GetProviderList
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetProviderList;
GO
CREATE PROCEDURE sp_GetProviderList
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ID, Name, IsVoip, COUNTRYID FROM tblProvider;
END
GO

-- ---------------------------------------------------------------------------
-- sp_MarkEmailAsSent
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_MarkEmailAsSent;
GO
CREATE PROCEDURE sp_MarkEmailAsSent
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE tbl_Emails
       SET sent = 1
     WHERE Id = @Id;
END
GO


ALTER TRIGGER [dbo].[TBLTRIGGER_tblSecrateryRole]
ON [dbo].[tblSecrateryRole]
AFTER INSERT, UPDATE

AS 

DECLARE @INS int, @DEL int

SELECT @INS = COUNT(*) FROM INSERTED
SELECT @DEL = COUNT(*) FROM DELETED

IF @INS > 0 AND @DEL > 0 
BEGIN

    -- a record got updated, so log accordingly.
    
    
    INSERT INTO TBL_AT_DETAILS (NEW_VALUE,OLD_VALUE) values( '(Abc)'+(select SecrateryID from inserted) , (select SecrateryID from deleted))
    INSERT INTO TBL_AT_DETAILS (NEW_VALUE,OLD_VALUE) values( (select ManagerID from inserted) , (select ManagerID from deleted))
    INSERT INTO TBL_AT_DETAILS (NEW_VALUE,OLD_VALUE) values( (select CanApprove from inserted) , (select CanApprove from deleted))
    INSERT INTO TBL_AT_DETAILS (NEW_VALUE,OLD_VALUE) values( (select CanApprove from inserted) , (select CanApprove from deleted))
    
    
    
    DELETE FROM TBL_AT_DETAILS WHERE NEW_VALUE = OLD_VALUE; 
    DELETE FROM TBL_AT_DETAILS WHERE NEW_VALUE is Null and OLD_VALUE is null; 
    

    
END
GO

-- ============================================================================
--  sp_ManageDelegate  (TIS.NET10)
--  Manage bill-delegation records (tblSecrateryRole).
--    @Command = 1  Add
--    @Command = 2  Update
--    @Command = 3  Delete
--
--  Hardening notes vs. the legacy proc:
--   • The real data operation (INSERT/UPDATE/DELETE on tblSecrateryRole) now
--     runs FIRST and is the source of truth.
--   • Audit-trail writes to the vwTblUser_tblMaster / vwTBLDetails_TBLMaster
--     views are wrapped in TRY…CATCH so a faulty audit trigger (e.g. the
--     "converting varchar to bigint" issue) can never block a delegation
--     change. Audit failures are swallowed intentionally.
-- ============================================================================
ALTER PROCEDURE [dbo].[sp_ManageDelegate]
    @Command   int,
    @ID        int = NULL,
    @secid     int = NULL,
    @managerid int = NULL,
    @app       bit = NULL,
    @idt       bit = NULL
AS
BEGIN
    SET NOCOUNT ON;

    ----------------------------------------------------------------------------
    -- 1) ADD
    ----------------------------------------------------------------------------
    IF (@Command = 1)
    BEGIN
        INSERT INTO tblSecrateryRole ([SecrateryID], [ManagerID], [CanApprove], [CanIdentify])
        VALUES (@secid, @managerid, @app, @idt);

        DECLARE @NewId int = CAST(SCOPE_IDENTITY() AS int);

        BEGIN TRY
            INSERT INTO [vwTblUser_tblMaster] ([FORM_ID], [ACTION_NAME], [RESULT], [USERID])
            VALUES (4, 'Add New Secratery', 'Success', @NewId);
        END TRY
        BEGIN CATCH
            -- audit-trail failure must not break the delegation insert
        END CATCH
    END

    ----------------------------------------------------------------------------
    -- 2) UPDATE
    ----------------------------------------------------------------------------
    IF (@Command = 2)
    BEGIN
        UPDATE tblSecrateryRole
           SET [SecrateryID] = @secid,
               [ManagerID]   = @managerid,
               [CanApprove]  = @app,
               [CanIdentify] = @idt
         WHERE ID = @ID;

        BEGIN TRY
            INSERT INTO [vwTblUser_tblMaster] ([FORM_ID], [ACTION_NAME], [RESULT], [USERID])
            VALUES (4, 'Update Secratery', 'Success', @ID);
        END TRY
        BEGIN CATCH
            -- audit-trail failure must not break the delegation update
        END CATCH
    END

    ----------------------------------------------------------------------------
    -- 3) DELETE
    ----------------------------------------------------------------------------
    IF (@Command = 3)
    BEGIN
        DECLARE @SecName varchar(200) =
            (SELECT Name FROM tbluser
              WHERE UID = (SELECT SecrateryID FROM tblSecrateryRole WHERE ID = @ID));

        DELETE FROM tblSecrateryRole WHERE ID = @ID;

        BEGIN TRY
            INSERT INTO vwTblUser_tblMaster (FORM_ID, ACTION_NAME, RESULT, USERID)
            VALUES (4, 'Delete Secratery', 'Success', @ID);

            INSERT INTO vwTBLDetails_TBLMaster (SNO, AT_ID, NEW_VALUE, OLD_VALUE, FIELD_NAME)
            VALUES (4,
                    (SELECT ID FROM TBL_AT_MASTER
                      WHERE date1 = (SELECT MAX(date1) FROM TBL_AT_MASTER)),
                    '', @SecName, 'Delete Secratery');
        END TRY
        BEGIN CATCH
            -- audit-trail failure must not break the delegation delete
        END CATCH
    END
END
GO

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
GO
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
-- (and re-logged) on every run. NAME is returned so the UI can show a readable
-- list of employees that were marked inactive.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_GetUsersForActiveSync;
GO
CREATE PROCEDURE sp_GetUsersForActiveSync
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  UID,
            username,
            NAME,
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

PRINT 'All stored procedures created successfully.';
GO
